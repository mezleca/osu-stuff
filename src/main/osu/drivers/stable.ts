import {
    ICollectionResult,
    IBeatmapResult,
    BeatmapSetResult,
    BeatmapFile,
    ILegacyDatabase,
    IStableBeatmap,
    IStableBeatmapset,
    gamemode_from_code,
    stable_status_from_code
} from "@shared/types";
import { BaseDriver } from "./base";
import { stable_parser } from "../../binary/stable";
import { beatmap_processor } from "../../database/processor";
import { BeatmapRow } from "@shared/types";
import { config } from "../../database/config";

import fs from "fs";
import path from "path";
import audio_util from "@rel-packages/audio-utils";
import * as beatmap_parser from "@rel-packages/osu-beatmap-parser";

const CHUNK_SIZE = 100;

const build_beatmap = (beatmap: IStableBeatmap, processed?: BeatmapRow, temp: boolean = false): IBeatmapResult => {
    return {
        md5: beatmap.md5 || "",
        online_id: beatmap.difficulty_id,
        beatmapset_id: beatmap.beatmapset_id,
        title: beatmap.title || "unknown",
        artist: beatmap.artist || "unknown",
        creator: beatmap.creator || "unknown",
        difficulty: beatmap.difficulty || "unknown",
        source: beatmap.source || "",
        tags: beatmap.tags || "",
        star_rating: beatmap.star_rating[beatmap.mode],
        bpm: beatmap.bpm,
        length: beatmap.length,
        last_modified: String(beatmap.last_modification),
        ar: beatmap.ar,
        cs: beatmap.cs,
        hp: beatmap.hp,
        od: beatmap.od,
        status: stable_status_from_code(beatmap.status),
        mode: gamemode_from_code(beatmap.mode),
        temp: temp,
        duration: processed?.duration || 0,
        background: processed?.background || "",
        audio: processed?.audio || "",
        folder_name: beatmap.folder_name,
        file_name: beatmap.file,
        file_path: beatmap.file_path
    };
};

const build_beatmapset = (beatmapset: IStableBeatmapset, temp: boolean = false): BeatmapSetResult => {
    return {
        online_id: beatmapset.online_id,
        metadata: {
            artist: beatmapset.artist,
            title: beatmapset.title,
            creator: beatmapset.creator
        },
        beatmaps: Array.from(beatmapset.beatmaps),
        temp: temp
    };
};

class StableBeatmapDriver extends BaseDriver {
    osu!: ILegacyDatabase;

    constructor() {
        super();
    }

    initialize = async (force: boolean = false): Promise<boolean> => {
        if (this.initialized && !force) {
            return true;
        }

        const osu_database_file = path.resolve(config.get().stable_path, "osu!.db");
        const collection_database_file = path.resolve(config.get().stable_path, "collection.db");

        if (!fs.existsSync(osu_database_file) || !fs.existsSync(collection_database_file)) {
            console.error("failed to initialize stable driver (missing database files)");
            return false;
        }

        const osu_result = stable_parser.get_osu_data(osu_database_file);

        if (!osu_result.success) {
            console.error("failed to parse osu!.db:", osu_result.reason);
            return false;
        }

        const collection_result = stable_parser.get_collections_data(collection_database_file);

        if (!collection_result.success) {
            console.error("failed to parse collection.db:", collection_result.reason);
            return false;
        }

        this.osu = osu_result.data;
        this.collections = collection_result.data;
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
        const beatmaps_array = Array.from(this.osu.beatmaps.values())
            // only process beatmaps that we havent processed yet or modified ones
            .filter((b) => {
                const processed = processed_map.get(b.md5);
                if (!processed) return true;
                return processed.last_modified != String(b.last_modification);
            });

        console.log("[stable] processing", beatmaps_array.length, "beatmaps");

        await this.process_beatmap_chunks(beatmaps_array, processed_map, to_insert);

        if (to_insert.length > 0) {
            beatmap_processor.insert_beatmaps(to_insert);
        }

        beatmap_processor.hide_on_renderer();

        // populate in-memory maps with processed data
        for (const [md5, beatmap] of this.osu.beatmaps) {
            const processed = processed_map.get(md5);
            this.beatmaps.set(md5, build_beatmap(beatmap, processed));
        }

        for (const [id, beatmapset] of this.osu.beatmapsets) {
            this.beatmapsets.set(id, build_beatmapset(beatmapset));
        }

        // clear raw storage to reduce memory usage
        this.osu.beatmaps.clear();
        this.osu.beatmapsets.clear();
    };

    private process_beatmap_chunks = async (
        beatmaps: IStableBeatmap[],
        processed_map: Map<string, BeatmapRow>,
        to_insert: BeatmapRow[]
    ): Promise<void> => {
        const process_chunk = async (start_index: number) => {
            const end_index = Math.min(start_index + CHUNK_SIZE, beatmaps.length);

            for (let i = start_index; i < end_index; i++) {
                const beatmap = beatmaps[i];
                beatmap_processor.update_on_renderer(i, beatmaps.length);

                if (!beatmap.md5) {
                    continue;
                }

                const last_modified = String(beatmap.last_modification);
                const cached = processed_map.get(beatmap.md5);

                if (!cached || cached.last_modified != last_modified) {
                    const row = await this.process_single_beatmap(beatmap, last_modified);
                    if (row) {
                        to_insert.push(row);
                        processed_map.set(row.md5, row);
                    }
                }
            }

            if (end_index < beatmaps.length) {
                await new Promise((r) => setTimeout(r, 5));
                await process_chunk(end_index);
            }
        };

        await process_chunk(0);
    };

    private process_single_beatmap = async (beatmap: IStableBeatmap, last_modified: string): Promise<BeatmapRow | null> => {
        if (!beatmap.folder_name || !beatmap.file) {
            return null;
        }

        try {
            const file_location = path.join(config.get().stable_songs_path, beatmap.folder_name, beatmap.file);

            if (!fs.existsSync(file_location)) {
                return null;
            }

            const file_content = fs.readFileSync(file_location);
            const beatmap_properties = beatmap_parser.get_properties(file_content, ["AudioFilename", "Background"]);

            const background_location = beatmap_properties.Background
                ? path.join(config.get().stable_songs_path, beatmap.folder_name, beatmap_properties.Background)
                : "";

            const audio_location = beatmap_properties.AudioFilename
                ? path.join(config.get().stable_songs_path, beatmap.folder_name, beatmap_properties.AudioFilename)
                : "";

            const audio_duration = audio_location ? audio_util.get_duration(audio_location) : 0;

            return {
                md5: beatmap.md5,
                last_modified,
                background: background_location,
                audio: audio_location,
                video: "",
                duration: audio_duration
            };
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    get_player_name = (): string => {
        return this.osu.player_name;
    };

    add_collection = (name: string, beatmaps: string[]): boolean => {
        if (this.collections.has(name)) {
            return false;
        }

        this.collections.set(name, { name, beatmaps });
        this.should_update = true;
        return true;
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

        return this.beatmaps.delete(options.md5);
    };

    get_collection = (name: string): ICollectionResult | undefined => {
        return this.collections.get(name);
    };

    get_collections = (): ICollectionResult[] => {
        return Array.from(this.collections.values());
    };

    update_collection = (): boolean => {
        const result = stable_parser.write_collections_data(Array.from(this.collections.values()));

        if (!result.success) {
            console.error("failed to write collections:", result.reason);
            return false;
        }

        const target = path.resolve(config.get().stable_path, "collection.db");
        fs.writeFileSync(target, result.data);

        this.should_update = false;
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

    get_beatmap_files = async (md5: string): Promise<BeatmapFile[]> => {
        const result: BeatmapFile[] = [];
        const beatmap = await this.get_beatmap_by_md5(md5);

        if (!beatmap || !beatmap?.file_name || !beatmap?.file_path || !beatmap.audio) {
            console.warn("get_beatmap_files: failed to get beatmap file / audio", beatmap);
            return result;
        }

        const file_location = path.join(config.get().stable_songs_path, beatmap.file_path);
        const audio_location = beatmap.audio;
        const background_location = beatmap.background;

        if (!fs.existsSync(file_location) || !fs.existsSync(audio_location)) {
            console.warn("get_beatmap_files: failed to find ->", file_location, audio_location);
            return result;
        }

        result.push(
            {
                name: path.basename(file_location),
                location: file_location
            },
            {
                name: path.basename(audio_location),
                location: audio_location
            }
        );

        // only add background if it exists
        if (background_location && fs.existsSync(background_location)) {
            result.push({
                name: path.basename(background_location),
                location: background_location
            });
        }

        return result;
    };

    get_beatmapset_files = async (id: number): Promise<BeatmapFile[]> => {
        const beatmapset = this.beatmapsets.get(id);

        if (!beatmapset) {
            return [];
        }

        const get_file_location = (): string => {
            for (const md5 of beatmapset.beatmaps) {
                const beatmap = this.beatmaps.get(md5);

                if (!beatmap || !beatmap.folder_name) {
                    continue;
                }

                const full_file_path = path.join(config.get().stable_songs_path, beatmap.folder_name);

                if (!fs.existsSync(full_file_path)) {
                    continue;
                }

                return full_file_path;
            }

            return "";
        };

        const files: BeatmapFile[] = [];
        const full_dir_data = get_file_location();
        const all_set_files = fs.readdirSync(full_dir_data);

        for (const file of all_set_files) {
            files.push({ name: path.basename(file), location: path.join(full_dir_data, file) });
        }

        return files;
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
        const beatmapsets: BeatmapSetResult[] = [];
        const invalid: number[] = [];

        for (const id of ids) {
            const beatmapset = this.beatmapsets.get(id);

            if (!beatmapset) {
                invalid.push(id);
                continue;
            }

            beatmapsets.push(beatmapset);
        }

        return { beatmaps: beatmapsets, invalid };
    };

    dispose = async (): Promise<void> => {
        this.osu.beatmaps.clear();
        this.osu.beatmapsets.clear();
    };
}

export const stable_driver = new StableBeatmapDriver();
