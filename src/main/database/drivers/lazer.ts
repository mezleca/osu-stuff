import {
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
    IBeatmapSetFilter,
    BeatmapRow,
    lazer_status_from_code
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
import { beatmap_processor } from "../processor";

import beatmap_parser from "@rel-packages/osu-beatmap-parser";
import Realm from "realm";
import fs from "fs";
import path from "path";

const CHUNK_SIZE = 100;

const build_beatmap = (beatmap: BeatmapSchema, processed?: BeatmapRow, temp: boolean = false): IBeatmapResult => {
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
        status: lazer_status_from_code(beatmap.Status),
        mode: beatmap.Ruleset.Name || "",
        temp: temp,
        duration: processed?.duration || 0,
        background: processed?.background || "",
        audio: processed?.audio || ""
    };
};

const build_beatmapset = (beatmapset: BeatmapSetSchema, temp: boolean = false): BeatmapSetResult => {
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

    initialize = async (force: boolean = false): Promise<boolean> => {
        if (this.instance && !force) {
            return true;
        }

        const lazer_path = config.get().lazer_path ?? "";
        const realm_location = path.resolve(lazer_path, "client.realm");

        if (!fs.existsSync(realm_location)) {
            console.warn("failed to find:", realm_location);
            return false;
        }

        if (!this.instance) {
            this.instance = new Realm({
                path: realm_location,
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

        await this.process_beatmaps();
        this.initialized = true;

        return true;
    };

    private process_beatmaps = async (): Promise<void> => {
        beatmap_processor.show_on_renderer();

        const processed_rows = beatmap_processor.get_all_beatmaps();
        const processed_map = new Map<string, BeatmapRow>();

        for (const row of processed_rows) {
            processed_map.set(row.md5, row);
        }

        const to_insert: BeatmapRow[] = [];

        const collections = this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection");
        const beatmapsets = this.instance.objects<BeatmapSetSchema>("BeatmapSet");
        const beatmaps = this.instance.objects<BeatmapSchema>("Beatmap");

        const to_process = beatmaps.filter((b) => {
            if (!b.MD5Hash) return false;
            const processed = processed_map.get(b.MD5Hash);
            if (!processed) return true;
            return processed.last_modified != (b.LastLocalUpdate?.toString() ?? "");
        });

        console.log("[lazer] processing", to_process.length, "beatmaps");

        await this.process_beatmap_chunks(to_process, processed_map, to_insert);

        if (to_insert.length > 0) {
            beatmap_processor.insert_beatmaps(to_insert);
        }

        beatmap_processor.hide_on_renderer();

        // populate in-memory map with processed data
        for (const beatmap of beatmaps) {
            if (beatmap.MD5Hash) {
                const processed = processed_map.get(beatmap.MD5Hash);
                this.beatmaps.set(beatmap.MD5Hash, build_beatmap(beatmap, processed));
            }
        }

        // populate in-memory collections
        for (const collection of collections) {
            const name = collection.Name || "";
            this.collections.set(name, {
                name,
                beatmaps: Array.from(collection.BeatmapMD5Hashes)
            });
        }

        // populate in-memory sets
        for (const beatmapset of beatmapsets) {
            this.beatmapsets.set(beatmapset.OnlineID, build_beatmapset(beatmapset));
        }
    };

    private process_beatmap_chunks = async (
        beatmaps: (Realm.Object<BeatmapSchema, never> & BeatmapSchema)[],
        processed_map: Map<string, BeatmapRow>,
        to_insert: BeatmapRow[]
    ): Promise<void> => {
        const process_chunk = async (start_index: number) => {
            const end_index = Math.min(start_index + CHUNK_SIZE, beatmaps.length);

            for (let i = start_index; i < end_index; i++) {
                const beatmap = beatmaps[i];
                beatmap_processor.update_on_renderer(i, beatmaps.length);

                if (!beatmap.Hash || !beatmap.MD5Hash) {
                    continue;
                }

                const last_modified = beatmap.LastLocalUpdate?.toString() ?? "";
                const cached = processed_map.get(beatmap.MD5Hash);

                if (!cached || cached.last_modified != last_modified) {
                    const row = await this.process_single_beatmap(beatmap, last_modified);
                    if (row) {
                        to_insert.push(row);
                        processed_map.set(row.md5, row);
                    }
                }
            }

            if (end_index < beatmaps.length) {
                await process_chunk(end_index);
            }
        };

        await process_chunk(0);
    };

    private process_single_beatmap = async (beatmap: BeatmapSchema, last_modified: string): Promise<BeatmapRow | null> => {
        const osu_file = beatmap.BeatmapSet.Files.find((file_usage) => {
            return file_usage.File?.Hash == beatmap.Hash;
        });

        if (!osu_file || !osu_file.File?.Hash) {
            return null;
        }

        const file_path = get_lazer_file_location(osu_file.File.Hash);
        const beatmap_properties = beatmap_parser.get_properties(file_path, ["AudioFilename", "Background"]);

        const background_location = beatmap_properties.Background
            ? get_lazer_file_location(
                  beatmap.BeatmapSet.Files.find((file_usage) => {
                      return file_usage.Filename == beatmap_properties.Background;
                  })?.File?.Hash ?? ""
              )
            : "";

        const audio_location = beatmap_properties.AudioFilename
            ? get_lazer_file_location(
                  beatmap.BeatmapSet.Files.find((file_usage) => {
                      return file_usage.Filename == beatmap_properties.AudioFilename;
                  })?.File?.Hash ?? ""
              )
            : "";

        const audio_duration = audio_location ? beatmap_parser.get_audio_duration(audio_location) : 0;

        return {
            md5: beatmap?.MD5Hash ?? "",
            last_modified,
            background: background_location,
            audio: audio_location,
            video: "",
            duration: audio_duration
        };
    };

    get_player_name = (): string => {
        return "lazer";
    };

    add_collection = (name: string, beatmaps: string[]): boolean => {
        if (this.collections.has(name)) {
            return false;
        }

        this.collections.set(name, { name, beatmaps });
        this.should_update = true;
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

                for (const realm_collection of existing) {
                    if (realm_collection.Name && !this.collections.has(realm_collection.Name)) {
                        this.instance.delete(realm_collection);
                    }
                }

                for (const [name, collection] of this.collections) {
                    const realm_collection = existing.filtered(`Name == $0`, name)[0];

                    if (realm_collection) {
                        realm_collection.BeatmapMD5Hashes = collection.beatmaps;
                        realm_collection.LastModified = new Date();
                    } else {
                        this.instance.create<BeatmapCollectionSchema>("BeatmapCollection", {
                            ID: new Realm.BSON.UUID(),
                            Name: name,
                            BeatmapMD5Hashes: collection.beatmaps,
                            LastModified: new Date()
                        });
                    }
                }
            });

            this.should_update = false;
            return true;
        } catch (error) {
            console.error("[LazerDriver] update_collection error:", error);
            return false;
        }
    };

    rename_collection = (old_name: string, new_name: string): boolean => {
        const collection = this.collections.get(old_name);

        if (!collection || this.collections.has(new_name)) {
            return false;
        }

        this.collections.delete(old_name);
        this.collections.set(new_name, { ...collection, name: new_name });
        this.should_update = true;
        return true;
    };

    delete_collection = (name: string): boolean => {
        const result = this.collections.delete(name);
        if (result) {
            this.should_update = true;
        }
        return result;
    };

    delete_beatmap = async (options: { md5: string; collection?: string }): Promise<boolean> => {
        if (options.collection) {
            const collection = this.collections.get(options.collection);
            if (!collection) {
                return false;
            }

            collection.beatmaps = collection.beatmaps.filter((b) => b != options.md5);
            this.should_update = true;
            return true;
        }

        this.pending_deletion.add(options.md5);
        return true;
    };

    add_beatmap = (beatmap: IBeatmapResult): boolean => {
        this.temp_beatmaps.set(beatmap.md5, beatmap);
        return true;
    };

    has_beatmap = (md5: string): boolean => {
        return this.beatmaps.has(md5);
    };

    has_beatmapset = (id: number): boolean => {
        return this.beatmapsets.has(id);
    };

    has_beatmapsets = (ids: number[]): boolean[] => {
        return ids.map((id) => this.has_beatmapset(id));
    };

    fetch_beatmaps = async (checksums: string[]): Promise<{ beatmaps: IBeatmapResult[]; invalid: string[] }> => {
        const beatmaps: IBeatmapResult[] = [];
        const invalid: string[] = [];

        for (const md5 of checksums) {
            const beatmap = this.beatmaps.get(md5);

            if (beatmap) {
                beatmaps.push(beatmap);
                continue;
            }

            const temp_beatmap = this.temp_beatmaps.get(md5);

            if (temp_beatmap) {
                beatmaps.push(temp_beatmap);
            } else {
                invalid.push(md5);
            }
        }

        return { beatmaps, invalid };
    };

    fetch_beatmapsets = async (ids: number[]): Promise<{ beatmaps: BeatmapSetResult[]; invalid: number[] }> => {
        const beatmaps: BeatmapSetResult[] = [];
        const invalid: number[] = [];

        for (const id of ids) {
            const beatmapset = this.beatmapsets.get(id);
            if (!beatmapset) {
                invalid.push(id);
                continue;
            }
            beatmaps.push(beatmapset);
        }

        return { beatmaps, invalid };
    };

    get_beatmap_by_md5 = async (md5: string): Promise<IBeatmapResult | undefined> => {
        return this.beatmaps.get(md5) || this.temp_beatmaps.get(md5);
    };

    get_beatmap_by_id = async (id: number): Promise<IBeatmapResult | undefined> => {
        for (const beatmap of this.beatmaps.values()) {
            if (beatmap.online_id == id) {
                return beatmap;
            }
        }

        for (const beatmap of this.temp_beatmaps.values()) {
            if (beatmap.online_id == id) {
                return beatmap;
            }
        }

        return undefined;
    };

    get_beatmapset = async (id: number): Promise<BeatmapSetResult | undefined> => {
        const result = this.beatmapsets.get(id);
        if (result) {
            return result;
        }

        const cached = this.temp_beatmapsets.get(id);
        if (cached) {
            return cached;
        }

        return undefined;
    };

    search_beatmaps = async (options: IBeatmapFilter): Promise<ISearchResponse> => {
        const checksums = new Set(
            options.collection ? this.get_collection(options.collection)?.beatmaps || [] : (await this.get_beatmaps()).map((b) => b.md5)
        );

        if (checksums.size == 0) {
            return { beatmaps: [], invalid: [] };
        }

        const { beatmaps, invalid } = await this.fetch_beatmaps(Array.from(checksums));
        const result = this.filter_beatmaps(beatmaps, options);

        return { beatmaps: result, invalid };
    };

    search_beatmapsets = async (options: IBeatmapSetFilter): Promise<ISearchSetResponse> => {
        let ids = Array.from(this.beatmapsets.keys());

        console.log("have", ids.length, "beatmapsets");

        if (ids.length == 0) {
            return { beatmapsets: [], invalid: [] };
        }

        if (options.query && options.query.trim() != "") {
            ids = this.filter_beatmapset_ids_by_query(ids, options.query);

            if (ids.length == 0) {
                return { beatmapsets: [], invalid: [] };
            }
        }

        const { beatmaps, invalid } = await this.fetch_beatmapsets(ids);
        const result = await this.filter_beatmapsets(beatmaps, options);

        return { beatmapsets: result, invalid };
    };

    private filter_beatmapset_ids_by_query = (ids: number[], query: string): number[] => {
        const query_lower = query.toLowerCase();
        const filtered_ids: number[] = [];

        for (const id of ids) {
            const beatmapset = this.beatmapsets.get(id);
            if (!beatmapset) {
                continue;
            }

            const matches_metadata =
                beatmapset.metadata.artist.toLowerCase().includes(query_lower) ||
                beatmapset.metadata.title.toLowerCase().includes(query_lower) ||
                beatmapset.metadata.creator.toLowerCase().includes(query_lower);

            let matches_beatmap = false;
            for (const md5 of beatmapset.beatmaps) {
                const beatmap = this.beatmaps.get(md5);
                if (!beatmap) {
                    continue;
                }

                if (
                    beatmap.difficulty.toLowerCase().includes(query_lower) ||
                    beatmap.tags.toString().toLowerCase().includes(query_lower) ||
                    beatmap.source?.toLowerCase().includes(query_lower)
                ) {
                    matches_beatmap = true;
                    break;
                }
            }

            if (matches_metadata || matches_beatmap) {
                filtered_ids.push(id);
            }
        }

        return filtered_ids;
    };

    get_beatmaps = async (): Promise<IFilteredBeatmap[]> => {
        const beatmaps = Array.from(this.beatmaps.keys());

        for (const md5 of this.temp_beatmaps.keys()) {
            if (md5) {
                beatmaps.push(md5);
            }
        }

        return beatmaps.map((md5) => ({ md5 }));
    };

    get_beatmapsets = async (): Promise<IFilteredBeatmapSet[]> => {
        const beatmapsets: IFilteredBeatmapSet[] = [];

        for (const beatmapset of this.beatmapsets.values()) {
            beatmapsets.push({
                id: beatmapset.online_id,
                beatmaps: beatmapset.beatmaps
            });
        }

        return beatmapsets;
    };

    get_beatmapset_files = async (id: number): Promise<BeatmapFile[]> => {
        const files: BeatmapFile[] = [];
        const beatmapset = this.instance.objects<BeatmapSetSchema>("BeatmapSet").find((b) => b.OnlineID == id);

        if (!beatmapset) {
            return files;
        }

        for (const file of beatmapset.Files) {
            if (!file.File || !file.Filename || !file.File.Hash) {
                console.warn("skipping invalid file:", file);
                continue;
            }

            files.push({
                name: file.Filename,
                location: get_lazer_file_location(file.File.Hash)
            });
        }

        return files;
    };

    dispose = async (): Promise<void> => {
        this.instance.close();
    };
}

export const lazer_driver = new LazerBeatmapDriver();
