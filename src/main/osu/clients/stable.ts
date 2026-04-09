import type { ICollectionResult, IBeatmapResult, BeatmapSetResult, BeatmapFile, BeatmapRow } from "@shared/types";
import { OsuCollectionDbParser, OsuDbParser } from "../parsers";
import { BaseClient } from "./base";
import { process_beatmap_task } from "../beatmap_worker";
import { beatmap_processor } from "../../database/processor";
import { config } from "../../database/config";

import fs from "fs";
import path from "path";

class StableBeatmapClient extends BaseClient {
    private player_name: string = "";
    private osu_db_parser = new OsuDbParser();
    private collection_db_parser = new OsuCollectionDbParser();
    private processed_map = new Map<string, BeatmapRow>();
    private beatmap_id_index = new Map<number, string>();

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
            console.error("failed to initialize stable client (missing database files)");
            return false;
        }

        try {
            await this.osu_db_parser.parse(osu_database_file);
        } catch (err) {
            console.error("failed to parse osu!.db:", err);
            return false;
        }

        try {
            await this.collection_db_parser.parse(collection_database_file);
        } catch (err) {
            console.error("failed to parse collection.db:", err);
            return false;
        }

        const osu_header = this.osu_db_parser.get_header();
        const beatmap_md5s = this.osu_db_parser.get_minimal_list();
        const parsed_beatmapsets = new Map<number, BeatmapSetResult>();

        const collection_data = this.collection_db_parser.get();
        const collections = new Map<string, ICollectionResult>();

        for (let i = 0; i < collection_data.collections.length; i++) {
            const collection = collection_data.collections[i];
            collections.set(collection.name, {
                name: collection.name,
                beatmaps: collection.beatmap_md5,
                last_modified: 0
            });
        }

        this.player_name = osu_header.player_name;
        this.collections = collections;
        this.beatmaps.clear();
        this.beatmapsets.clear();
        this.beatmap_id_index.clear();

        for (let i = 0; i < beatmap_md5s.length; i++) {
            const beatmap = beatmap_md5s[i];
            if (!beatmap?.md5) continue;

            this.beatmaps.set(beatmap.md5, beatmap);

            if (beatmap.online_id > 0) {
                this.beatmap_id_index.set(beatmap.online_id, beatmap.md5);
            }

            const set_id = beatmap.beatmapset_id;
            const existing = parsed_beatmapsets.get(set_id);

            if (!existing) {
                parsed_beatmapsets.set(set_id, {
                    online_id: set_id,
                    metadata: {
                        artist: beatmap.artist,
                        title: beatmap.title,
                        creator: beatmap.creator
                    },
                    beatmaps: [beatmap.md5],
                    temp: false
                });
            } else {
                existing.beatmaps.push(beatmap.md5);
            }
        }

        let fallback_set_id = -1;
        for (const [id, beatmapset] of parsed_beatmapsets) {
            const preferred_id = beatmapset.online_id || id;
            const resolved_id = preferred_id > 0 && !this.beatmapsets.has(preferred_id) ? preferred_id : fallback_set_id--;
            this.beatmapsets.set(resolved_id, { ...beatmapset, online_id: resolved_id });
        }

        this.processed_map.clear();

        const processed_rows = beatmap_processor.get_all_beatmaps();

        for (const row of processed_rows) {
            this.processed_map.set(row.md5, row);
        }

        for (const beatmap of this.beatmaps.values()) {
            const processed = this.processed_map.get(beatmap.md5);
            if (!processed) continue;

            beatmap.duration = processed.duration;
            beatmap.background = processed.background;
            beatmap.audio = processed.audio;
        }

        this.initialized = true;
        await this.process_beatmaps();
        return true;
    };

    private process_beatmaps = async (): Promise<void> => {
        beatmap_processor.show_on_renderer();

        const to_insert: BeatmapRow[] = [];
        const beatmaps_array = Array.from(this.beatmaps.values())
            // only process beatmaps that we havent processed yet or modified ones
            .filter((b) => {
                const processed = this.processed_map.get(b.md5);
                if (!processed) return true;
                return processed.last_modified != b.last_modified;
            });

        console.log("[stable] processing", beatmaps_array.length, "beatmaps");

        for (let i = 0; i < beatmaps_array.length; i++) {
            const beatmap = beatmaps_array[i];
            beatmap_processor.update_on_renderer(i, beatmaps_array.length);

            if (!beatmap.md5) {
                continue;
            }

            const last_modified = beatmap.last_modified;
            const cached = this.processed_map.get(beatmap.md5);

            if (!cached || cached.last_modified != last_modified) {
                const row = await this.process_single_beatmap(beatmap, last_modified);
                if (row) {
                    to_insert.push(row);
                    this.processed_map.set(row.md5, row);

                    beatmap.duration = row.duration;
                    beatmap.background = row.background;
                    beatmap.audio = row.audio;
                }
            }
        }

        if (to_insert.length > 0) {
            beatmap_processor.insert_beatmaps(to_insert);
        }

        beatmap_processor.hide_on_renderer();
    };
    private process_single_beatmap = async (beatmap: IBeatmapResult, last_modified: string): Promise<BeatmapRow | null> => {
        if (!beatmap.folder_name || !beatmap.file_name) {
            return null;
        }

        try {
            const file_location = path.join(config.get().stable_songs_path, beatmap.folder_name, beatmap.file_name);
            return process_beatmap_task({
                kind: "stable",
                md5: beatmap.md5,
                last_modified,
                osu_file_location: file_location,
                stable_songs_path: config.get().stable_songs_path,
                folder_name: beatmap.folder_name
            });
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    get_player_name = (): string => {
        return this.player_name;
    };

    has_beatmap = (md5: string): boolean => {
        return this.temp_beatmaps.has(md5) || this.beatmaps.has(md5);
    };

    get_beatmaps = (): IBeatmapResult[] => {
        return [...this.temp_beatmaps.values(), ...this.beatmaps.values()];
    };

    get_beatmap_by_md5 = async (md5: string): Promise<IBeatmapResult | undefined> => {
        return this.temp_beatmaps.get(md5) || this.beatmaps.get(md5);
    };

    get_beatmap_by_id = async (id: number): Promise<IBeatmapResult | undefined> => {
        const md5 = this.beatmap_id_index.get(id);
        if (!md5) {
            return undefined;
        }
        return this.get_beatmap_by_md5(md5);
    };

    delete_beatmap = async (options: { md5: string; collection?: string }): Promise<boolean> => {
        if (options.collection) {
            return this.remove_beatmap_from_collection(options.collection, options.md5);
        }

        return this.beatmaps.delete(options.md5);
    };

    update_collection = async (): Promise<boolean> => {
        const collections = Array.from(this.collections.values()).map((collection) => ({
            name: collection.name,
            beatmaps_count: collection.beatmaps.length,
            beatmap_md5: collection.beatmaps
        }));

        try {
            this.collection_db_parser.update({
                collections,
                collections_count: collections.length
            });
            await this.collection_db_parser.write();
        } catch (err) {
            console.error("failed to write collections:", err);
            return false;
        }

        this.reset_collection_modifications();
        this.should_update = false;
        return true;
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
        if (!full_dir_data || !fs.existsSync(full_dir_data)) {
            return files;
        }
        const all_set_files = fs.readdirSync(full_dir_data);

        for (const file of all_set_files) {
            files.push({ name: path.basename(file), location: path.join(full_dir_data, file) });
        }

        return files;
    };

    dispose = async (): Promise<void> => {
        this.beatmaps.clear();
        this.beatmapsets.clear();
        this.collections.clear();
        this.beatmap_id_index.clear();
        this.processed_map.clear();
        this.osu_db_parser?.free();
        this.collection_db_parser?.free();
    };
}

export const stable_client = new StableBeatmapClient();
