import {
    beatmap_status_from_code,
    IBeatmapFilter,
    IBeatmapResult,
    BeatmapSetResult,
    ICollectionResult,
    LAZER_DATABASE_VERSION,
    BeatmapFile
} from "@shared/types/osu";
import {
    BeatmapCollectionSchema,
    BeatmapDifficultySchema,
    BeatmapMetadataSchema,
    BeatmapSchema,
    BeatmapSetSchema,
    BeatmapUserSettingsSchema,
    FileSchema,
    RealmNamedFileUsageSchema,
    RealmUserSchema,
    RulesetSchema
} from "./schemas/lazer";
import { BaseDriver } from "./base";
import { config } from "../database/config";
import { get_lazer_file_location } from "../beatmaps/beatmaps";

import Realm from "realm";
import path from "path";

const build_beatmap = (beatmap: BeatmapSchema, temp: boolean = false): IBeatmapResult => {
    return {
        md5: beatmap.MD5Hash || "",
        online_id: beatmap.OnlineID,
        beatmapset_id: beatmap.BeatmapSet.OnlineID,
        title: beatmap.Metadata.Title || "unknown",
        artist: beatmap.Metadata.Artist || "unknown",
        creator: beatmap.Metadata.Author?.Username || "unknown",
        difficulty: beatmap.DifficultyName || "unknown",
        source: beatmap.Metadata.Source || "",
        tags: beatmap.Metadata.Tags || "",
        star_rating: beatmap.StarRating,
        bpm: beatmap.BPM,
        length: beatmap.Length,
        ar: beatmap.Difficulty.ApproachRate,
        cs: beatmap.Difficulty.CircleSize,
        hp: beatmap.Difficulty.DrainRate,
        od: beatmap.Difficulty.OverallDifficulty,
        status: beatmap_status_from_code(beatmap.Status),
        mode: beatmap.Ruleset.Name || "",
        local: true,
        temp: temp
    };
};

const build_beamapset = (beatmapset: BeatmapSetSchema, temp: boolean = false): BeatmapSetResult => {
    const ref_beatmap = beatmapset.Beatmaps[0];
    return {
        online_id: beatmapset.OnlineID,
        metadata: {
            artist: ref_beatmap.Metadata.Artist || "unknown",
            title: ref_beatmap.Metadata.Title || "unknown",
            creator: ref_beatmap.Metadata.Author?.Username || "unknown"
        },
        beatmaps: beatmapset.Beatmaps.map((b) => b.MD5Hash).filter((b) => b != undefined)
    };
};

class LazerBeatmapDriver extends BaseDriver {
    instance!: Realm;

    constructor() {
        super();
    }

    initialize = async (): Promise<void> => {
        const lazer_location = path.resolve(config.get().lazer_path, "client.realm");

        if (this.instance) {
            console.warn("skipping lazer driver initialiation");
            return;
        }

        this.instance = new Realm({
            path: lazer_location,
            schema: [
                BeatmapDifficultySchema,
                BeatmapMetadataSchema,
                BeatmapUserSettingsSchema,
                BeatmapCollectionSchema,
                BeatmapSetSchema,
                BeatmapSchema,
                RealmUserSchema,
                RulesetSchema,
                FileSchema,
                RealmNamedFileUsageSchema
            ] as any,
            schemaVersion: LAZER_DATABASE_VERSION
        });
    };

    // TODO: does lazer even save that information?
    get_player_name = (): string => {
        return "lazer";
    };

    add_collection = (name: string, beatmaps: string[]): boolean => {
        this.instance.write(() => {
            const uuid = new Realm.BSON.UUID();
            this.instance.create<BeatmapCollectionSchema>("BeatmapCollection", {
                ID: uuid,
                Name: name,
                BeatmapMD5Hashes: beatmaps,
                LastModified: new Date()
            });
        });

        return true;
    };

    get_collections = (): ICollectionResult[] => {
        return this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection").map((a) => ({
            name: a.Name || "",
            beatmaps: a.BeatmapMD5Hashes
        }));
    };

    get_collection = (name: string): ICollectionResult | undefined => {
        return this.get_collections().find((c) => c.name == name);
    };

    update_collection = (collections: ICollectionResult[]): boolean => {
        if (!this.instance) {
            return false;
        }

        const saved_collections = Array.from(this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection"));

        for (const collection of collections) {
            const existing_collection = saved_collections.find((c) => c.Name == collection.name);
            if (existing_collection) {
                this.instance.write(() => {
                    existing_collection.Name = collection.name;
                    existing_collection.BeatmapMD5Hashes = collection.beatmaps || [];
                    existing_collection.LastModified = new Date();
                });
            } else {
                this.add_collection(collection.name, collection.beatmaps);
            }
        }

        return true;
    };

    delete_collection = (name: string): boolean => {
        const desired = this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection").find((c) => c.Name == name);

        if (!desired) {
            console.log("failed to find:", name);
            return false;
        }

        this.instance.write(() => {
            this.instance.delete(desired);
        });

        return true;
    };

    // TOFIX: yeah, right its only possible to add temp beatmaps
    // in the near future i will also allow to build the beatmap based on files, etc using the beatmap builder system
    // (still wip)
    add_beatmap = (beatmap: IBeatmapResult): boolean => {
        this.add_to_temp(beatmap);
        return true;
    };

    fetch_beatmaps = async (checksums: string[]): Promise<IBeatmapResult[]> => {
        // get stored beatmaps
        const beatmaps = this.instance
            .objects<BeatmapSchema>("Beatmap")
            .filtered("MD5Hash IN $0", checksums)
            .map((b) => build_beatmap(b));

        // get temp beatmaps
        // temp shouldnt be that big so just loop over then
        for (const temp of this.temp_beatmaps.values()) {
            if (checksums.includes(temp.md5)) {
                beatmaps.push(temp);
            }
        }

        return beatmaps;
    };

    get_beatmap_by_md5 = async (md5: string): Promise<IBeatmapResult | undefined> => {
        // check we its sitting on temp
        const temp = this.get_from_temp_by_md5(md5);

        if (temp) {
            return temp;
        }

        // otherwise check on db
        const result = this.instance.objects<BeatmapSchema>("Beatmap").find((b) => b.MD5Hash == md5);

        if (!result) {
            return undefined;
        }

        return build_beatmap(result);
    };

    get_beatmap_by_id = async (id: number): Promise<IBeatmapResult | undefined> => {
        // check we its sitting on temp
        const temp = this.get_from_temp_by_id(id);

        if (temp) {
            return temp;
        }

        // otherwise check on db
        const result = this.instance.objects<BeatmapSchema>("Beatmap").find((b) => b.OnlineID == id);

        if (!result) {
            return undefined;
        }

        return build_beatmap(result);
    };

    get_beatmapset = async (set_id: number): Promise<BeatmapSetResult | undefined> => {
        const result = this.instance.objects<BeatmapSetSchema>("BeatmapSet").find((b) => b.OnlineID == set_id);

        if (!result) {
            return undefined;
        }

        return build_beamapset(result);
    };

    search_beatmaps = async (options: IBeatmapFilter): Promise<string[]> => {
        const checksums = new Set(options.collection ? this.get_collection(options.collection)?.beatmaps || [] : await this.get_all_beatmaps());

        if (checksums.size == 0) {
            return [];
        }

        // get beatmaps on storage
        const beatmaps = await this.fetch_beatmaps(Array.from(checksums));

        // return filtered beatmaps
        return this.filter_beatmaps(beatmaps, options);
    };

    get_all_beatmaps = async (): Promise<string[]> => {
        const beatmaps = this.instance.objects<BeatmapSchema>("Beatmap").map((b) => b.MD5Hash);

        // also add temp beatmaps
        for (const [key, _] of this.temp_beatmaps) {
            beatmaps.push(key);
        }

        return beatmaps.filter((b) => b != undefined);
    };

    get_beatmapset_files = async (id: number): Promise<BeatmapFile[]> => {
        const files: BeatmapFile[] = [];
        const beatmapset = this.instance.objects<BeatmapSetSchema>("BeatmapSet").find((b) => b.OnlineID == id);

        if (!beatmapset) {
            return files;
        }

        for (const file of beatmapset.Files) {
            // why optional peppy, why???
            if (!file.File || !file.Filename || !file.File.Hash) {
                console.warn("skipping cuz invalid file :(", file);
                continue;
            }

            files.push({ name: file.Filename, location: get_lazer_file_location(file.File.Hash) });
        }

        return files;
    };

    dispose = async (): Promise<void> => {
        this.instance.close();
    };
}

export const lazer_driver = new LazerBeatmapDriver();
