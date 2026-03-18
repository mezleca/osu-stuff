import { gamemode_from_code, stable_status_from_code } from "@shared/types";
import type { ICollectionResult, IBeatmapResult, BeatmapSetResult, BeatmapFile, BeatmapRow } from "@shared/types";
import { BeatmapParser, OsuCollectionDbParser, OsuDbParser } from "@rel-packages/osu-parser";
import type { OsuDbBeatmapMinimal } from "@rel-packages/osu-parser";
import { BaseClient } from "./base";
import { beatmap_processor } from "../../database/processor";
import { config } from "../../database/config";

import fs from "fs";
import path from "path";
import audio_util from "@rel-packages/audio-utils";

const CHUNK_SIZE = 100;

const get_beatmap_properties = async (file_location: string) => {
    const parser = new BeatmapParser();

    try {
        await parser.parse(file_location);
        const data = parser.get();

        return {
            AudioFilename: data.General.AudioFilename ?? "",
            Background: data.Events.background?.filename ?? ""
        };
    } finally {
        parser.free();
    }
};

type StableBeatmapset = {
    title: string;
    artist: string;
    creator: string;
    online_id: number;
    beatmaps: Set<string>;
};

type StableOsuData = {
    player_name: string;
    beatmaps: Map<string, OsuDbBeatmapMinimal>;
    beatmapsets: Map<number, StableBeatmapset>;
};

const build_beatmap = (beatmap: OsuDbBeatmapMinimal, processed?: BeatmapRow, temp: boolean = false): IBeatmapResult => {
    return {
        md5: beatmap.md5 || "",
        online_id: beatmap.difficulty_id,
        beatmapset_id: beatmap.beatmap_id,
        title: beatmap.title || "unknown",
        artist: beatmap.artist || "unknown",
        creator: beatmap.creator || "unknown",
        difficulty: beatmap.difficulty || "unknown",
        source: beatmap.source || "",
        tags: beatmap.tags || "",
        star_rating: beatmap.star_rating ?? 0,
        bpm: beatmap.bpm ?? 0,
        length: beatmap.total_time,
        last_modified: String(beatmap.last_modification_time),
        ar: beatmap.approach_rate,
        cs: beatmap.circle_size,
        hp: beatmap.hp_drain,
        od: beatmap.overall_difficulty,
        status: stable_status_from_code(beatmap.ranked_status),
        mode: gamemode_from_code(beatmap.mode),
        temp: temp,
        duration: beatmap.duration ?? processed?.duration ?? 0,
        background: processed?.background || "",
        audio: processed?.audio || "",
        folder_name: beatmap.folder_name,
        file_name: beatmap.osu_file_name,
        file_path: path.join(beatmap.folder_name, beatmap.osu_file_name)
    };
};

const build_beatmapset = (beatmapset: StableBeatmapset, temp: boolean = false): BeatmapSetResult => {
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

class StableBeatmapClient extends BaseClient {
    osu!: StableOsuData;
    private osu_db_parser = new OsuDbParser();
    private collection_db_parser = new OsuCollectionDbParser();

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
        const beatmaps = new Map<string, OsuDbBeatmapMinimal>();
        const beatmapsets = new Map<number, StableBeatmapset>();
        const beatmaps_list: OsuDbBeatmapMinimal[] = [];

        for (let i = 0; i < beatmap_md5s.length; i++) {
            const beatmap = beatmap_md5s[i];
            if (!beatmap?.md5) continue;
            beatmaps_list.push(beatmap);
            beatmaps.set(beatmap.md5, beatmap);

            const set_id = beatmap.beatmap_id;
            const existing = beatmapsets.get(set_id);

            if (!existing) {
                beatmapsets.set(set_id, {
                    title: beatmap.title,
                    artist: beatmap.artist,
                    creator: beatmap.creator,
                    online_id: set_id,
                    beatmaps: new Set([beatmap.md5])
                });
            } else {
                existing.beatmaps.add(beatmap.md5);
            }
        }

        const collection_data = this.collection_db_parser.get();
        const collections = new Map<string, ICollectionResult>();

        for (let i = 0; i < collection_data.collections.length; i++) {
            const collection = collection_data.collections[i];
            collections.set(collection.name, {
                name: collection.name,
                beatmaps: collection.beatmap_md5,
                last_modified: 0
            });

            if (i > 0 && i % 2000 === 0) {
                await new Promise((r) => setTimeout(r, 0));
            }
        }

        this.osu = {
            player_name: osu_header.player_name,
            beatmaps,
            beatmapsets
        };

        this.collections = collections;
        this.beatmaps.clear();
        this.beatmapsets.clear();

        const processed_rows = beatmap_processor.get_all_beatmaps();
        const processed_map = new Map<string, BeatmapRow>();

        for (const row of processed_rows) {
            processed_map.set(row.md5, row);
        }

        await this.process_beatmaps(beatmaps_list, processed_map);

        this.initialized = true;
        return true;
    };

    private process_beatmaps = async (raw_beatmaps: OsuDbBeatmapMinimal[], processed_map: Map<string, BeatmapRow>): Promise<void> => {
        beatmap_processor.show_on_renderer();

        const to_insert: BeatmapRow[] = [];
        const beatmaps_array = Array.from(this.osu.beatmaps.values())
            // only process beatmaps that we havent processed yet or modified ones
            .filter((b) => {
                const processed = processed_map.get(b.md5);
                if (!processed) return true;
                return processed.last_modified != String(b.last_modification_time);
            });

        console.log("[stable] processing", beatmaps_array.length, "beatmaps");

        await this.process_beatmap_chunks(beatmaps_array, processed_map, to_insert);

        if (to_insert.length > 0) {
            beatmap_processor.insert_beatmaps(to_insert);
        }

        const duration_updates: { md5: string; duration: number }[] = [];

        for (const beatmap of raw_beatmaps) {
            const processed = processed_map.get(beatmap.md5);
            if (!processed) {
                continue;
            }
            if (processed.duration != null && processed.duration > 0 && beatmap.duration !== processed.duration) {
                beatmap.duration = processed.duration;
                duration_updates.push({ md5: beatmap.md5, duration: processed.duration });
            }
        }

        if (duration_updates.length > 0) {
            try {
                this.osu_db_parser.update_duration(duration_updates);
            } catch (err) {
                console.warn("[stable] failed to update beatmap duration:", err);
            }
        }

        beatmap_processor.hide_on_renderer();

        // populate in-memory maps with processed data
        for (const [md5, beatmap] of this.osu.beatmaps) {
            const processed = processed_map.get(md5);
            this.beatmaps.set(md5, build_beatmap(beatmap, processed));
        }

        let fallback_set_id = -1;

        for (const [id, beatmapset] of this.osu.beatmapsets) {
            const mapped = build_beatmapset(beatmapset);
            const preferred_id = mapped.online_id || id;
            const resolved_id = preferred_id > 0 && !this.beatmapsets.has(preferred_id) ? preferred_id : fallback_set_id--;
            this.beatmapsets.set(resolved_id, { ...mapped, online_id: resolved_id });
        }

        // clear raw storage to reduce memory usage
        this.osu.beatmaps.clear();
        this.osu.beatmapsets.clear();
    };

    private process_beatmap_chunks = async (
        beatmaps: OsuDbBeatmapMinimal[],
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

                const last_modified = String(beatmap.last_modification_time);
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

    private process_single_beatmap = async (beatmap: OsuDbBeatmapMinimal, last_modified: string): Promise<BeatmapRow | null> => {
        if (!beatmap.folder_name || !beatmap.osu_file_name) {
            return null;
        }

        try {
            const file_location = path.join(config.get().stable_songs_path, beatmap.folder_name, beatmap.osu_file_name);

            if (!fs.existsSync(file_location)) {
                return null;
            }

            const beatmap_properties = await get_beatmap_properties(file_location);

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

        this.collections.set(name, { name, beatmaps, last_modified: this.get_collection_timestamp() });
        this.should_update = true;
        return true;
    };

    rename_collection = (old_name: string, new_name: string): boolean => {
        const collection = this.collections.get(old_name);
        if (!collection || this.collections.has(new_name)) {
            return false;
        }

        this.collections.delete(old_name);
        this.collections.set(new_name, { ...collection, name: new_name, last_modified: this.get_collection_timestamp() });
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
        if (!full_dir_data || !fs.existsSync(full_dir_data)) {
            return files;
        }
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
        this.osu_db_parser.free();
        this.collection_db_parser.free();
    };
}

export const stable_client = new StableBeatmapClient();
