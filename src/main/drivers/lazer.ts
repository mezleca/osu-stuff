import {
    beatmap_status_from_code,
    IBeatmapFilter,
    IBeatmapResult,
    BeatmapSetResult,
    ICollectionResult,
    LAZER_DATABASE_VERSION,
    BeatmapFile,
    IAddCollectionParams,
    IGetCollectionParams,
    IUpdateCollectionParams,
    IDeleteCollectionParams,
    IAddBeatmapParams,
    IFetchBeatmapsParams,
    IGetBeatmapByMd5Params,
    IGetBeatmapByIdParams,
    IGetBeatmapsetParams,
    IGetBeatmapsetFilesParams
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

import Realm from "realm";
import path from "path";
import { get_lazer_file_location } from "../beatmaps/beatmaps";

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
        beatmaps: beatmapset.Beatmaps.map((b) => build_beatmap(b, temp))
    };
};

class LazerBeatmapDriver extends BaseDriver {
    instance!: Realm;

    constructor() {
        super();
    }

    initialize = (): Promise<void> => {
        const lazer_location = path.resolve(config.get().lazer_path, "client.realm");
        console.log(lazer_location);

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

        return Promise.resolve();
    };

    // TODO: does lazer even save that information?
    get_player_name = (): string => {
        return "lazer";
    };

    add_collection = (params: IAddCollectionParams): boolean => {
        this.instance.write(() => {
            const uuid = new Realm.BSON.UUID();
            this.instance.create<BeatmapCollectionSchema>("BeatmapCollection", {
                ID: uuid,
                Name: params.name,
                BeatmapMD5Hashes: params.beatmaps,
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

    get_collection = (params: IGetCollectionParams): ICollectionResult | undefined => {
        return this.get_collections().find((c) => c.name == params.name);
    };

    update_collection = (params: IUpdateCollectionParams): boolean => {
        if (!this.instance) {
            return false;
        }

        const saved_collections = Array.from(this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection"));

        for (const collection of params.collections) {
            const existing_collection = saved_collections.find((c) => c.Name == collection.name);
            if (existing_collection) {
                this.instance.write(() => {
                    existing_collection.Name = collection.name;
                    existing_collection.BeatmapMD5Hashes = collection.beatmaps || [];
                    existing_collection.LastModified = new Date();
                });
            } else {
                this.add_collection({ 
                    name: collection.name, 
                    beatmaps: collection.beatmaps
                });
            }
        }

        return true;
    };

    delete_collection = (params: IDeleteCollectionParams): boolean => {
        const desired = this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection")
            .find((c) => c.Name == params.name);

        if (!desired) {
            console.log("failed to find:", params.name);
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
    add_beatmap = (params: IAddBeatmapParams): boolean => {
        this.add_to_temp(params.beatmap);
        return true;
    };

    fetch_beatmaps = (params: IFetchBeatmapsParams): Promise<IBeatmapResult[]> => {
        // get stored beatmaps
        const beatmaps = this.instance
            .objects<BeatmapSchema>("Beatmap")
            .filtered("MD5Hash IN $0", params.checksums)
            .map((b) => build_beatmap(b));

        // get temp beatmaps
        // temp shouldnt be that big so just loop over then
        for (const temp of this.temp_beatmaps.values()) {
            if (params.checksums.includes(temp.md5)) {
                beatmaps.push(temp);
            }
        }

        return Promise.resolve(beatmaps);
    };

    get_beatmap_by_md5 = (params: IGetBeatmapByMd5Params): Promise<IBeatmapResult | undefined> => {
        // check we its sitting on temp
        const temp = this.get_from_temp_by_md5(params.md5);

        if (temp) {
            return Promise.resolve(temp);
        }

        // otherwise check on db
        const result = this.instance.objects<BeatmapSchema>("Beatmap")
            .find((b) => b.MD5Hash == params.md5);

        if (!result) {
            return Promise.resolve(undefined);
        }

        return Promise.resolve(build_beatmap(result));
    };

    get_beatmap_by_id = (params: IGetBeatmapByIdParams): Promise<IBeatmapResult | undefined> => {
        // check we its sitting on temp
        const temp = this.get_from_temp_by_id(params.id);

        if (temp) {
            return Promise.resolve(temp);
        }

        // otherwise check on db
        const result = this.instance.objects<BeatmapSchema>("Beatmap")
            .find((b) => b.OnlineID == params.id);

        if (!result) {
            return Promise.resolve(undefined);
        }

        return Promise.resolve(build_beatmap(result));
    };

    get_beatmapset = (params: IGetBeatmapsetParams): Promise<BeatmapSetResult | undefined> => {
        const result = this.instance.objects<BeatmapSetSchema>("BeatmapSet")
            .find((b) => b.OnlineID == params.set_id);

        if (!result) {
            return Promise.resolve(undefined);
        }

        return Promise.resolve(build_beamapset(result));
    };

    search_beatmaps = async (options: IBeatmapFilter): Promise<string[]> => {
        const checksums = new Set(options.collection ?
            this.get_collection({ name: options.collection })?.beatmaps || [] :
            await this.get_all_beatmaps()
        );

        if (checksums.size == 0) {
            return Promise.resolve([]);
        }

        // get beatmaps on storage
        const beatmaps = await this.fetch_beatmaps({ checksums: Array.from(checksums) });

        // return filtered beatmaps
        return this.filter_beatmaps(beatmaps, options);
    };

    get_all_beatmaps = (): Promise<string[]> => {
        const beatmaps = this.instance
            .objects<BeatmapSchema>("Beatmap")
            .map((b) => b.MD5Hash);

        // also add temp beatmaps
        for (const [key, _] of this.temp_beatmaps) {
            beatmaps.push(key);
        }
        
        return Promise.resolve(beatmaps.filter((b) => b != undefined));
    };

    get_beatmapset_files = (params: IGetBeatmapsetFilesParams): Promise<BeatmapFile[]> => {
        const files: BeatmapFile[] = [];
        const beatmapset = this.instance.objects<BeatmapSetSchema>("BeatmapSet")
            .find((b) => b.OnlineID == params.id);

        if (!beatmapset) {
            return Promise.resolve(files);
        }

        for (const file of beatmapset.Files) {
            // why optional peppy, why???
            if (!file.File || !file.Filename || !file.File.Hash) {
                console.warn("skipping cuz invalid file :(", file);
                continue;
            }

            files.push({ name: file.Filename, location: get_lazer_file_location(file.File.Hash) });
        }

        return Promise.resolve(files);
    };

    dispose = (): Promise<void> => {
        this.instance.close();
        return Promise.resolve();
    };
}

export const lazer_driver = new LazerBeatmapDriver();
