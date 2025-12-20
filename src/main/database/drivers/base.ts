import {
    IOsuDriver,
    IBeatmapFilter,
    IBeatmapResult,
    BeatmapSetResult,
    ICollectionResult,
    IOSDBData,
    OsdbVersion,
    IOSDBCollection,
    BeatmapFile,
    gamemode_to_code,
    ISearchResponse,
    ISearchSetResponse,
    IBeatmapSetFilter
} from "@shared/types";
import { check_beatmap_difficulty, filter_beatmap_by_query, sort_beatmaps, sort_beatmapset } from "../../beatmaps/beatmaps";
import { osdb_parser } from "../../binary/osdb";
import { stable_parser } from "../../binary/stable";
import { config } from "../config";

import path from "path";
import JSzip from "jszip";
import fs from "fs";

export abstract class BaseDriver implements IOsuDriver {
    protected initialized: boolean = false;

    // in memory shit
    beatmaps: Map<string, IBeatmapResult> = new Map();
    beatmapsets: Map<number, BeatmapSetResult> = new Map();
    collections: Map<string, ICollectionResult> = new Map();
    pending_deletion: Set<string> = new Set();
    pending_collection_removals: Map<string, Set<string>> = new Map();

    // main state
    should_update: boolean = false;

    // temp storage for beatmaps
    protected temp_beatmaps: Map<string, IBeatmapResult> = new Map();
    protected temp_beatmapsets: Map<number, BeatmapSetResult> = new Map();

    is_initialized = (): boolean => {
        return this.initialized;
    };

    filter_beatmap = (beatmap: IBeatmapResult, options: IBeatmapFilter): boolean => {
        if (beatmap.beatmapset_id == -1) return false;
        if (options.difficulty_range && !check_beatmap_difficulty(beatmap, options.difficulty_range)) return false;
        if (options.query && !filter_beatmap_by_query(beatmap, options.query)) return false;
        if (options.status && beatmap.status?.toLowerCase() != options.status?.toLowerCase()) return false;
        return true;
    };

    search_beatmaps = async (options: IBeatmapFilter): Promise<ISearchResponse> => {
        // unify both database beatmaps / recently download in a single map
        // TODO: the fact that we still need to get hashes to then get the actual beatmap data pmo
        const beatmaps = options?.collection ? this.collections.get(options.collection)?.beatmaps : this.get_beatmaps().map((b) => b.md5);

        if (!beatmaps || beatmaps?.length == 0) {
            return { beatmaps: [], invalid: [] };
        }

        const unique_ids: Set<string> = new Set();
        const valid_beatmaps: IBeatmapResult[] = [];
        const invalid_beatmaps: string[] = [];

        for (const checksum of beatmaps) {
            const beatmap = await this.get_beatmap_by_md5(checksum);

            if (!beatmap) {
                invalid_beatmaps.push(checksum);
                continue;
            }

            // get unique id (or creator a new one if not available)
            const unique_id = beatmap?.unique_id ? beatmap.unique_id : `${beatmap.beatmapset_id}_${beatmap?.audio ?? "unknown"}`;

            // first, check if we already have that unique beatmap stored
            if (options.unique && unique_ids.has(unique_id)) {
                continue;
            }

            // now check for the other filters
            const is_valid_beatmap = this.filter_beatmap(beatmap, options);

            if (!is_valid_beatmap) {
                invalid_beatmaps.push(checksum);
                continue;
            }

            valid_beatmaps.push(beatmap);
            unique_ids.add(unique_id);
        }

        const minified_result = options.sort
            ? sort_beatmaps(valid_beatmaps, options.sort).map((b) => ({ md5: b.md5 }))
            : valid_beatmaps.map((b) => ({ md5: b.md5 }));

        return {
            beatmaps: minified_result,
            invalid: invalid_beatmaps
        };
    };

    search_beatmapsets = async (options: IBeatmapSetFilter): Promise<ISearchSetResponse> => {
        // unify both database sets / recently download in a single map
        const unified_maps = new Map([...this.beatmapsets, ...this.temp_beatmapsets]);

        if (unified_maps.size == 0) {
            return { beatmapsets: [], invalid: [] };
        }

        // if a beatmapset has any diff that matches the current
        // add it here
        const valid_beatmapsets: BeatmapSetResult[] = [];
        // also store the invalid ones for later
        const invalid_beatmapsets: number[] = [];

        for (const [id, beatmapset] of unified_maps) {
            // fetch stored beatmaps from beatmapset
            const { beatmaps } = await this.fetch_beatmaps(beatmapset.beatmaps);

            // add as invalid if we didn't find anything
            if (beatmaps.length == 0) {
                invalid_beatmapsets.push(id);
                continue;
            }

            // also store valid beatmaps to check later
            const valid_beatmaps: string[] = [];

            for (const beatmap of beatmaps) {
                const is_valid_beatmap = this.filter_beatmap(beatmap, { query: options.query, sort: options.sort, unique: false });
                if (!is_valid_beatmap) continue;

                valid_beatmaps.push(beatmap.md5);
            }

            // add as invalid if all of the beatmaps dont match
            if (valid_beatmaps.length == 0) {
                invalid_beatmapsets.push(id);
            } else {
                valid_beatmapsets.push({ ...beatmapset, beatmaps: valid_beatmaps });
            }
        }

        return {
            beatmapsets: options.sort ? sort_beatmapset(valid_beatmapsets, options.sort) : valid_beatmapsets,
            invalid: invalid_beatmapsets
        };
    };

    private write_osdb_collection = async (collections: ICollectionResult[]) => {
        const osdb_data: IOSDBData = {
            collections: [],
            count: 0,
            last_editor: this.get_player_name(),
            save_date: BigInt(new Date().getTime())
        };

        const output_name = collections.map((c) => c.name).join("-") + `.osdb`;

        for (const collection of collections) {
            // create new osdb collection
            const osdb_collection: IOSDBCollection = {
                name: collection.name,
                beatmaps: [],
                hash_only_beatmaps: []
            };

            // add data from previous collection
            for (const hash of collection.beatmaps) {
                const beatmap = await this.get_beatmap_by_md5(hash);

                if (!beatmap) {
                    continue;
                }

                osdb_collection.beatmaps.push({
                    difficulty_id: beatmap.online_id,
                    beatmapset_id: beatmap.beatmapset_id,
                    artist: beatmap.artist,
                    title: beatmap.title,
                    diff_name: beatmap.difficulty,
                    md5: beatmap.md5,
                    difficulty_rating: beatmap.star_rating,
                    mode: gamemode_to_code(beatmap.mode)
                });
            }

            osdb_data.collections.push(osdb_collection);
            osdb_data.count++;
            osdb_collection.hash_only_beatmaps = collection.beatmaps;
        }

        // get buffer
        const result = osdb_parser.write(OsdbVersion.O_DM8_MIN, osdb_data);

        if (!result.success) {
            return false;
        }

        const buffer = result.data as Buffer;
        const location = path.resolve(config.get().export_path, output_name);

        if (!fs.existsSync(path.dirname(location))) {
            fs.mkdirSync(path.dirname(location));
        }

        fs.writeFileSync(location, buffer);
        return true;
    };

    private write_stable_collection(collections: ICollectionResult[]): boolean {
        const output_name = collections.map((c) => c.name).join("-") + `.db`;

        // get buffer
        const result = stable_parser.write_collections_data(collections);

        if (!result.success) {
            return false;
        }

        const buffer = result.data;
        const location = path.resolve(config.get().export_path, output_name);

        if (!fs.existsSync(path.dirname(location))) {
            fs.mkdirSync(path.dirname(location));
        }

        fs.writeFileSync(location, buffer);
        return true;
    }

    export_collections = async (collections: ICollectionResult[], type: string): Promise<boolean> => {
        return type == "osdb" ? this.write_osdb_collection(collections) : this.write_stable_collection(collections);
    };

    // TOFIX: 50%~ slower than before? idk
    export_beatmapset = async (id: number): Promise<boolean> => {
        const files = await this.get_beatmapset_files(id);

        if (files.length == 0) {
            console.error("export_beatmapset: couldn't get beatmap files...");
            return false;
        }

        const zip = new JSzip();

        for (const file of files) {
            // skip folders to prevent "EISDIR"
            if (fs.statSync(file.location).isDirectory()) {
                console.warn("export_beatmapset: skipping directory:", file.location);
                continue;
            }

            if (!fs.existsSync(file.location)) {
                console.warn("export_beatmapset: failed to find", file);

                // panic if the missing file is a .osu one
                if (path.extname(file.name) == ".osu") {
                    return false;
                }

                continue;
            }

            const buffer = fs.readFileSync(file.location);

            if (!buffer) {
                console.warn("export_beatmapset: failed to get buffer from", file);
                continue;
            }

            zip.file(file.name, buffer);
        }

        const buffer = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 9 }
        });

        const location = path.resolve(config.get().export_path, `${id}.osz`);

        if (!fs.existsSync(path.dirname(location))) {
            fs.mkdirSync(path.dirname(location));
        }

        fs.writeFileSync(location, buffer);

        return true;
    };

    get_missing_beatmaps = async (name: string | null): Promise<string[]> => {
        let hashes: string[] = [];

        if (name) {
            hashes = this.get_collection(name)?.beatmaps ?? [];
        } else {
            const collections = this.get_collections();
            const unique_hashes = new Set<string>();

            for (const collection of collections) {
                for (const hash of collection.beatmaps) {
                    if (hash) {
                        unique_hashes.add(hash);
                    }
                }
            }

            hashes = Array.from(unique_hashes);
        }

        if (hashes.length == 0) {
            return [];
        }

        const missing_beatmaps: string[] = [];

        // parallel checks for performance
        const results = await Promise.all(
            hashes.map(async (md5) => {
                const beatmap = await this.get_beatmap_by_md5(md5);
                if (!beatmap || beatmap.temp) {
                    return md5;
                }
                return null;
            })
        );

        for (const md5 of results) {
            if (md5) {
                missing_beatmaps.push(md5);
            }
        }

        if (missing_beatmaps.length > 0) {
            console.log(`[driver] found ${missing_beatmaps.length} missing beatmaps out of ${hashes.length} checked`);
        }

        return missing_beatmaps;
    };

    add_beatmaps_to_collection(collection_name: string, hashes: string[]): boolean {
        const collection = this.collections.get(collection_name);
        if (!collection) {
            return false;
        }

        const all_hashes = new Set([...collection.beatmaps, ...hashes]);
        collection.beatmaps = Array.from(all_hashes);

        return true;
    }

    add_beatmap(beatmap: IBeatmapResult): boolean {
        this.temp_beatmaps.set(beatmap.md5, beatmap);

        const set_id = beatmap.beatmapset_id;
        let set = this.temp_beatmapsets.get(set_id);

        if (!set) {
            // check if we already have the set in memory
            const real_set = this.beatmapsets.get(set_id);

            if (real_set) {
                // if we have, clone it to add the new difficulty
                set = {
                    ...real_set,
                    beatmaps: [...real_set.beatmaps],
                    temp: true
                };

                this.temp_beatmapsets.set(set_id, set);
            } else {
                // otherwise, create a new one
                set = {
                    online_id: set_id,
                    metadata: {
                        artist: beatmap.artist,
                        title: beatmap.title,
                        creator: beatmap.creator
                    },
                    beatmaps: [],
                    temp: true
                };

                this.temp_beatmapsets.set(set_id, set);
            }
        }

        console.log(`has ${beatmap.md5}: ${set.beatmaps.includes(beatmap.md5)}`);

        if (!set.beatmaps.includes(beatmap.md5)) {
            set.beatmaps.push(beatmap.md5);
        }

        return true;
    }

    add_beatmapset(beatmapset: BeatmapSetResult): boolean {
        this.temp_beatmapsets.set(beatmapset.online_id, beatmapset);
        return true;
    }

    get_beatmaps(): IBeatmapResult[] {
        return [...this.temp_beatmaps.values(), ...this.beatmaps.values()];
    }

    get_beatmapsets(): BeatmapSetResult[] {
        return [...this.temp_beatmapsets.values(), ...this.beatmapsets.values()];
    }

    async get_beatmapset(set_id: number): Promise<BeatmapSetResult | undefined> {
        let set = this.temp_beatmapsets.get(set_id);

        if (set) {
            return set;
        }

        return this.beatmapsets.get(set_id);
    }

    // driver based implementation
    abstract initialize(force?: boolean): Promise<boolean>;
    abstract get_player_name(): string;
    abstract add_collection(name: string, beatmaps: string[]): boolean;
    abstract rename_collection(old_name: string, new_name: string): boolean;
    abstract delete_collection(name: string): boolean;
    abstract delete_beatmap(options: { md5: string; collection?: string }): Promise<boolean>;
    abstract get_collection(name: string): ICollectionResult | undefined;
    abstract get_collections(): ICollectionResult[];
    abstract update_collection(): boolean;
    abstract has_beatmap(md5: string): boolean;
    abstract has_beatmapset(id: number): boolean;
    abstract get_beatmap_by_md5(md5: string): Promise<IBeatmapResult | undefined>;
    abstract get_beatmap_by_id(id: number): Promise<IBeatmapResult | undefined>;
    abstract get_beatmapset_files(id: number): Promise<BeatmapFile[]>;
    abstract fetch_beatmaps(checksums: string[]): Promise<{ beatmaps: IBeatmapResult[]; invalid: string[] }>;
    abstract fetch_beatmapsets(ids: number[]): Promise<{ beatmaps: BeatmapSetResult[]; invalid: number[] }>;
    abstract dispose(): Promise<void>;
    abstract has_beatmapsets(ids: number[]): boolean[];
}
