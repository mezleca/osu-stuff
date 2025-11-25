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
import { get_lazer_file_location } from "../../beatmaps/beatmaps";

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

    initialize = async (force: boolean = false): Promise<void> => {
        if (this.instance && !force) {
            return;
        }

        const lazer_location = path.resolve(config.get().lazer_path, "client.realm");

        if (!this.instance) {
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
        }

        // populate base driver maps
        this.collections.clear();
        this.beatmaps.clear();
        this.beatmapsets.clear();

        const collections = this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection");
        for (const collection of collections) {
            this.collections.set(collection.Name || "", {
                name: collection.Name || "",
                beatmaps: collection.BeatmapMD5Hashes
            });
        }

        const beatmaps = this.instance.objects<BeatmapSchema>("Beatmap");
        for (const beatmap of beatmaps) {
            if (beatmap.MD5Hash) {
                this.beatmaps.set(beatmap.MD5Hash, build_beatmap(beatmap));
            }
        }

        const beatmapsets = this.instance.objects<BeatmapSetSchema>("BeatmapSet");
        for (const beatmapset of beatmapsets) {
            this.beatmapsets.set(beatmapset.OnlineID, build_beamapset(beatmapset));
        }

        this.initialized = true;
    };

    // TODO: does lazer even save that information?
    get_player_name = (): string => {
        return "lazer";
    };

    add_collection = (name: string, beatmaps: string[]): boolean => {
        if (this.collections.has(name)) return false;

        this.collections.set(name, { name, beatmaps });
        return true;
    };

    get_collections = (): ICollectionResult[] => {
        return Array.from(this.collections.values());
    };

    get_collection = (name: string): ICollectionResult | undefined => {
        return this.collections.get(name);
    };

    update_collection = (): boolean => {
        if (!this.instance) {
            return false;
        }

        try {
            this.instance.write(() => {
                const existing = this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection");

                // remove collections that no longer exist in memory
                for (const realm_collection of existing) {
                    if (realm_collection.Name && !this.collections.has(realm_collection.Name)) {
                        this.instance.delete(realm_collection);
                    }
                }

                // add or update collections from memory
                for (const [name, collection] of this.collections) {
                    const realm_collection = existing.filtered(`Name == $0`, name)[0];

                    if (realm_collection) {
                        // update existing
                        realm_collection.BeatmapMD5Hashes = collection.beatmaps;
                        realm_collection.LastModified = new Date();
                    } else {
                        // create new
                        this.instance.create<BeatmapCollectionSchema>("BeatmapCollection", {
                            ID: new Realm.BSON.UUID(),
                            Name: name,
                            BeatmapMD5Hashes: collection.beatmaps,
                            LastModified: new Date()
                        });
                    }
                }
            });

            return true;
        } catch (error) {
            console.error("[LazerDriver] update_collection error:", error);
            return false;
        }
    };

    rename_collection = (old_name: string, new_name: string): boolean => {
        const collection = this.collections.get(old_name);

        if (!collection) {
            return false;
        }

        if (this.collections.has(new_name)) {
            return false;
        }

        this.collections.delete(old_name);
        this.collections.set(new_name, { ...collection, name: new_name });

        return true;
    };

    delete_collection = (name: string): boolean => {
        const result = this.collections.delete(name);
        return result;
    };

    delete_beatmap = async (options: { md5: string; collection?: string }): Promise<boolean> => {
        if (options.collection) {
            const collection = this.collections.get(options.collection);
            if (collection) {
                collection.beatmaps = collection.beatmaps.filter((b) => b != options.md5);
                return true;
            }
            return false;
        }

        // TODO: handle global beatmap deletion in actions if needed
        this.pending_deletion.add(options.md5);
        return true;
    };

    add_beatmap = (beatmap: IBeatmapResult): boolean => {
        this.temp_beatmaps.set(beatmap.md5, beatmap);
        return true;
    };

    has_beatmap(md5: string): boolean {
        return this.beatmaps.has(md5);
    }

    has_beatmapset(id: number): boolean {
        return this.beatmapsets.has(id);
    }

    has_beatmapsets(ids: number[]): boolean[] {
        return ids.map((id) => this.has_beatmapset(id));
    }

    fetch_beatmaps = async (checksums: string[]): Promise<{ beatmaps: IBeatmapResult[]; invalid: string[] }> => {
        const hashes: Set<string> = new Set();

        // get stored beatmaps
        const beatmaps = this.instance
            .objects<BeatmapSchema>("Beatmap")
            .filtered("MD5Hash IN $0", checksums)
            .map((b) => {
                if (b.MD5Hash) hashes.add(b.MD5Hash);
                return build_beatmap(b);
            });

        const invalid = checksums.filter((c) => !hashes.has(c));

        // get temp beatmaps
        for (const [_, cached] of this.temp_beatmaps) {
            if (!hashes.has(cached.md5) && checksums.includes(cached.md5)) {
                beatmaps.push(cached);
            }
        }

        return { beatmaps, invalid };
    };

    fetch_beatmapsets = async (ids: number[]): Promise<{ beatmaps: BeatmapSetResult[]; invalid: number[] }> => {
        const valid_ids: Set<number> = new Set();
        const beatmaps = this.instance
            .objects<BeatmapSetSchema>("BeatmapSet")
            .filtered("OnlineID IN $0", ids)
            .map((b) => {
                valid_ids.add(b.OnlineID);
                return build_beamapset(b);
            });

        const invalid = ids.filter((i) => !valid_ids.has(i));

        return { beatmaps, invalid };
    };

    get_beatmap_by_md5 = async (md5: string): Promise<IBeatmapResult | undefined> => {
        // first, attempt to get local beatmap
        const result = this.instance.objects<BeatmapSchema>("Beatmap").find((b) => b.MD5Hash == md5);

        if (result) {
            return build_beatmap(result);
        }

        // now, attempt to get from cached beatmaps (temp)
        const cached = this.temp_beatmaps.get(md5);

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
        for (const [_, cached] of this.temp_beatmaps) {
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
        const cached = this.temp_beatmapsets.get(id);

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
            return { beatmaps: [], invalid: [] };
        }

        // get beatmaps on storage
        const { beatmaps, invalid } = await this.fetch_beatmaps(Array.from(checksums));
        const result = this.filter_beatmaps(beatmaps, options);

        // return filtered beatmaps
        return { beatmaps: result, invalid };
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
                return { beatmapsets: [], invalid: [] };
            }

            const ids = Array.from(matching_set_ids);
            const { beatmaps, invalid } = await this.fetch_beatmapsets(ids);
            const result = await this.filter_beatmapsets(beatmaps, options);

            return { beatmapsets: result, invalid };
        }

        // no query filter, process all beatmapsets
        const ids = beatmapset_query.map((b) => b.OnlineID);

        if (ids.length == 0) {
            return { beatmapsets: [], invalid: [] };
        }

        // get beatmaps on storage
        const { beatmaps, invalid } = await this.fetch_beatmapsets(ids);
        const result = await this.filter_beatmapsets(beatmaps, options);

        // return filtered beatmaps
        return { beatmapsets: result, invalid };
    };

    get_beatmaps = async (): Promise<IFilteredBeatmap[]> => {
        const beatmaps = new Set(this.instance.objects<BeatmapSchema>("Beatmap").map((b) => b.MD5Hash));
        const filtered: IFilteredBeatmap[] = [];

        // also add temp beatmaps
        for (const [key, _] of this.temp_beatmaps) {
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
