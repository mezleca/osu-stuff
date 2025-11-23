import {
    beatmap_status_from_code,
    IBeatmapFilter,
    IBeatmapResult,
    BeatmapSetResult,
    ICollectionResult,
    LAZER_DATABASE_VERSION,
    BeatmapFile,
    ISearchResponse,
    ISearchSetResponse,
    IFilteredBeatmap,
    IFilteredBeatmapSet,
    IBeatmapSetFilter
} from "@shared/types";
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
import { config } from "../config";
import { cached_beatmaps, cached_beatmapsets, get_lazer_file_location } from "../../beatmaps/beatmaps";

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
        last_modified: beatmap.LastLocalUpdate?.toString() || "",
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
        beatmaps: beatmapset.Beatmaps.map((b) => b.MD5Hash).filter((b) => b != undefined),
        temp: temp
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

        // TODO: now process everything :)
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
        return this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection").map((a) => {
            const pending = this.pending_collection_removals.get(a.Name || "") || new Set();
            return {
                name: a.Name || "",
                beatmaps: a.BeatmapMD5Hashes.filter((h) => !pending.has(h))
            };
        });
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
                this.pending_collection_removals.delete(collection.name);
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

    delete_beatmap = async (options: { md5: string; collection?: string }): Promise<boolean> => {
        if (options.collection) {
            if (!this.pending_collection_removals.has(options.collection)) {
                this.pending_collection_removals.set(options.collection, new Set());
            }
            this.pending_collection_removals.get(options.collection)!.add(options.md5);
            return true;
        }

        this.pending_deletion.add(options.md5);
        return true;
    };

    add_beatmap = (beatmap: IBeatmapResult): boolean => {
        cached_beatmaps.set(beatmap.md5, beatmap);
        return true;
    };

    has_beatmap(md5: string): boolean {
        return !!this.instance.objects<BeatmapSchema>("Beatmap").find((b) => b.MD5Hash == md5);
    }

    has_beatmapset(id: number): boolean {
        return !!this.instance.objects<BeatmapSetSchema>("BeatmapSet").find((b) => b.OnlineID == id);
    }

    has_beatmapsets(ids: number[]): boolean[] {
        return ids.map((id) => this.has_beatmapset(id));
    }

    fetch_beatmaps = async (checksums: string[]): Promise<IBeatmapResult[]> => {
        const hashes: Set<string> = new Set();

        // get stored beatmaps
        const beatmaps = this.instance
            .objects<BeatmapSchema>("Beatmap")
            .filtered("MD5Hash IN $0", checksums)
            .map((b) => {
                if (b.MD5Hash) hashes.add(b.MD5Hash);
                return build_beatmap(b);
            });

        // get temp beatmaps
        for (const [_, cached] of cached_beatmaps) {
            if (!hashes.has(cached.md5) && checksums.includes(cached.md5)) {
                beatmaps.push(cached);
            }
        }

        return beatmaps;
    };

    fetch_beatmapsets = async (ids: number[]): Promise<BeatmapSetResult[]> => {
        return this.instance
            .objects<BeatmapSetSchema>("BeatmapSet")
            .filtered("OnlineID IN $0", ids)
            .map((b) => build_beamapset(b));
    };

    get_beatmap_by_md5 = async (md5: string): Promise<IBeatmapResult | undefined> => {
        // first, attempt to get local beatmap
        const result = this.instance.objects<BeatmapSchema>("Beatmap").find((b) => b.MD5Hash == md5);

        if (result) {
            return build_beatmap(result);
        }

        // now, attempt to get from cached beatmaps (temp)
        const cached = cached_beatmaps.get(md5);

        if (cached) {
            return cached;
        }

        return undefined;
    };

    get_beatmap_by_id = async (id: number): Promise<IBeatmapResult | undefined> => {
        // first, attempt to get local beatmap
        const result = this.instance.objects<BeatmapSchema>("Beatmap").find((b) => b.OnlineID == id);

        if (result) {
            return build_beatmap(result);
        }

        // now, attempt to get from cached beatmaps (temp)
        for (const [_, cached] of cached_beatmaps) {
            if (cached.online_id == id) {
                return cached;
            }
        }

        return undefined;
    };

    get_beatmapset = async (id: number): Promise<BeatmapSetResult | undefined> => {
        const result = this.instance.objects<BeatmapSetSchema>("BeatmapSet").find((b) => b.OnlineID == id);

        if (result) {
            return build_beamapset(result);
        }

        // now, attempt to get from cached beatmaps (temp)
        const cached = cached_beatmapsets.get(id);

        if (cached) {
            return cached;
        }

        return undefined;
    };

    search_beatmaps = async (options: IBeatmapFilter): Promise<ISearchResponse> => {
        // TOFIX: ABSOLUTE PIECE OF GARBAGE
        const checksums = new Set(
            options.collection ? this.get_collection(options.collection)?.beatmaps || [] : (await this.get_beatmaps()).map((b) => b.md5)
        );

        if (checksums.size == 0) {
            return { beatmaps: [] };
        }

        // get beatmaps on storage
        const beatmaps = await this.fetch_beatmaps(Array.from(checksums));
        const result = this.filter_beatmaps(beatmaps, options);

        // return filtered beatmaps
        return { beatmaps: result };
    };

    search_beatmapsets = async (options: IBeatmapSetFilter): Promise<ISearchSetResponse> => {
        let beatmapset_query = this.instance.objects<BeatmapSetSchema>("BeatmapSet");

        // filter by query if query exists
        if (options.query && options.query.trim() != "") {
            const matching_beatmaps = this.instance
                .objects<BeatmapSchema>("Beatmap")
                .filtered(
                    "Metadata.Artist CONTAINS[c] $0 OR Metadata.Title CONTAINS[c] $0 OR Metadata.Author.Username CONTAINS[c] $0 OR DifficultyName CONTAINS[c] $0",
                    options.query
                );

            const matching_set_ids = new Set<number>();
            for (const beatmap of matching_beatmaps) {
                matching_set_ids.add(beatmap.BeatmapSet.OnlineID);
            }

            if (matching_set_ids.size == 0) {
                return { beatmapsets: [] };
            }

            const ids = Array.from(matching_set_ids);
            const beatmapsets = await this.fetch_beatmapsets(ids);
            const result = await this.filter_beatmapsets(beatmapsets, options);

            return { beatmapsets: result };
        }

        // no query filter, process all beatmapsets
        const ids = beatmapset_query.map((b) => b.OnlineID);

        if (ids.length == 0) {
            return { beatmapsets: [] };
        }

        // get beatmaps on storage
        const beatmapsets = await this.fetch_beatmapsets(ids);
        const result = await this.filter_beatmapsets(beatmapsets, options);

        // return filtered beatmaps
        return { beatmapsets: result };
    };

    get_beatmaps = async (): Promise<IFilteredBeatmap[]> => {
        const beatmaps = new Set(this.instance.objects<BeatmapSchema>("Beatmap").map((b) => b.MD5Hash));
        const filtered: IFilteredBeatmap[] = [];

        // also add temp beatmaps
        for (const [key, _] of cached_beatmaps) {
            beatmaps.add(key);
        }

        for (const md5 of beatmaps) {
            if (!md5 || this.pending_deletion.has(md5)) continue;
            filtered.push({ md5 });
        }

        return filtered;
    };

    get_beatmapsets = async (): Promise<IFilteredBeatmapSet[]> => {
        const beatmapsets = this.instance.objects<BeatmapSetSchema>("BeatmapSet");
        const filtered: IFilteredBeatmapSet[] = [];

        for (const beatmapset of beatmapsets) {
            filtered.push({
                id: beatmapset.OnlineID,
                beatmaps: beatmapset.Beatmaps.map((b) => b.MD5Hash).filter((b) => b != undefined)
            });
        }

        return filtered;
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
