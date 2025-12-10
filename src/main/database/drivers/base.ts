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
    IFilteredBeatmapSet,
    IFilteredBeatmap,
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

    filter_beatmaps = (beatmaps: IBeatmapResult[], options: IBeatmapFilter): IFilteredBeatmap[] => {
        const unique = new Set<string>();
        const result: IBeatmapResult[] = [];

        for (const beatmap of beatmaps) {
            if (options.status && beatmap.status?.toLowerCase() != options.status?.toLowerCase()) {
                continue;
            }

            if (options.unique) {
                let uid = beatmap.unique_id;

                if (!uid || uid == "") {
                    if (beatmap.audio && beatmap.beatmapset_id) {
                        uid = `${beatmap.audio}_${beatmap.beatmapset_id}`;
                    }
                }

                if (!uid || uid == "") continue;
                if (unique.has(uid)) continue;
                unique.add(uid);
            }

            if (options.difficulty_range && !check_beatmap_difficulty(beatmap, options.difficulty_range)) {
                continue;
            }

            if (options.query && !filter_beatmap_by_query(beatmap, options.query)) {
                continue;
            }

            result.push(beatmap);
        }

        return sort_beatmaps(result, options.sort).map((b) => ({ md5: b.md5 }));
    };

    filter_beatmapsets = async (sets: BeatmapSetResult[], options: IBeatmapSetFilter): Promise<IFilteredBeatmapSet[]> => {
        const result: BeatmapSetResult[] = [];

        for (const beatmapset of sets) {
            const fetched = await this.fetch_beatmaps(beatmapset.beatmaps);
            const filtered_diffs: string[] = [];

            for (const beatmap of fetched.beatmaps) {
                if (options.difficulty_range && !check_beatmap_difficulty(beatmap, options.difficulty_range)) {
                    continue;
                }

                if (options.query && !filter_beatmap_by_query(beatmap, options.query)) {
                    continue;
                }

                if (options.status && beatmap.status?.toLowerCase() != options.status?.toLowerCase()) {
                    continue;
                }

                filtered_diffs.push(beatmap.md5);
            }

            // dont send empty sets
            if (filtered_diffs.length == 0) {
                continue;
            }

            result.push({
                online_id: beatmapset.online_id,
                metadata: beatmapset.metadata,
                beatmaps: filtered_diffs,
                temp: false
            });
        }

        return sort_beatmapset(result, options.sort).map((b) => ({
            beatmaps: b.beatmaps,
            id: b.online_id
        }));
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
        const beatmaps =
            (name
                ? this.get_collection(name)?.beatmaps
                : // if null, use stored beatmaps
                  (await this.get_beatmaps()).map((b) => b.md5)) ?? [];

        if (!beatmaps) {
            return [];
        }

        const missing_beatmaps: string[] = [];

        for (let i = 0; i < beatmaps.length; i++) {
            const md5 = beatmaps[i];
            const beatmap = await this.get_beatmap_by_md5(md5);

            if (beatmap && !beatmap.temp) {
                continue;
            }

            missing_beatmaps.push(md5);
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
    abstract add_beatmap(beatmap: IBeatmapResult): boolean;
    abstract get_beatmap_by_md5(md5: string): Promise<IBeatmapResult | undefined>;
    abstract get_beatmap_by_id(id: number): Promise<IBeatmapResult | undefined>;
    abstract get_beatmapset(set_id: number): Promise<BeatmapSetResult | undefined>;
    abstract search_beatmaps(options: IBeatmapFilter): Promise<ISearchResponse>;
    abstract search_beatmapsets(params: IBeatmapSetFilter): Promise<ISearchSetResponse>;
    abstract get_beatmaps(): Promise<IFilteredBeatmap[]>;
    abstract get_beatmapsets(): Promise<IFilteredBeatmapSet[]>;
    abstract get_beatmapset_files(id: number): Promise<BeatmapFile[]>;
    abstract fetch_beatmaps(checksums: string[]): Promise<{ beatmaps: IBeatmapResult[]; invalid: string[] }>;
    abstract fetch_beatmapsets(ids: number[]): Promise<{ beatmaps: BeatmapSetResult[]; invalid: number[] }>;
    abstract dispose(): Promise<void>;
    abstract has_beatmapsets(ids: number[]): boolean[];
}
