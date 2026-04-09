import {
    ALL_BEATMAPS_KEY,
    ALL_MODES_KEY,
    ALL_STATUS_KEY,
    gamemode_from_code,
    gamemode_to_code,
    stable_status_from_code,
    stable_status_to_code
} from "@shared/types";
import type { ICollectionResult, IBeatmapFilter, IBeatmapResult, BeatmapSetResult, BeatmapFile, BeatmapRow, ISearchResponse } from "@shared/types";
import { BeatmapParser, OsuCollectionDbParser, OsuDbParser } from "../parsers";
import type { OsuDbBeatmapMinimal, OsuDbFilterProperties } from "../parsers";
import { BaseClient } from "./base";
import { parse_query, sort_beatmaps } from "../beatmaps";
import { get_audio_duration } from "../audio";
import { beatmap_processor } from "../../database/processor";
import { config } from "../../database/config";

import fs from "fs";
import path from "path";

const DEFAULT_MIN_DIFFICULTY = 0;
const DEFAULT_MAX_DIFFICULTY = 10;

const get_beatmap_properties = async (file_location: string) => {
    const parser = new BeatmapParser();

    try {
        await parser.parse(file_location);
        const media = parser.get_media();

        return {
            AudioFilename: media.AudioFilename ?? "",
            Background: media.Background ?? "",
            Duration: media.Duration ?? 0
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

const matches_temp_query = (beatmap: IBeatmapResult, query: string): boolean => {
    if (!query) {
        return true;
    }

    const normalized_query = query.toLowerCase();
    const target = `${beatmap.artist} ${beatmap.title} ${beatmap.creator} ${beatmap.difficulty}`.toLowerCase();
    return target.includes(normalized_query);
};

class StableBeatmapClient extends BaseClient {
    osu!: StableOsuData;
    private osu_db_parser = new OsuDbParser();
    private collection_db_parser = new OsuCollectionDbParser();
    private processed_map = new Map<string, BeatmapRow>();
    private all_beatmaps_sort_cache = new Map<keyof IBeatmapResult, string[]>();

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
        for (let i = 0; i < beatmap_md5s.length; i++) {
            const beatmap = beatmap_md5s[i];
            if (!beatmap?.md5) continue;
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
        }

        this.osu = {
            player_name: osu_header.player_name,
            beatmaps,
            beatmapsets
        };

        this.collections = collections;
        this.beatmaps.clear();
        this.beatmapsets.clear();
        this.all_beatmaps_sort_cache.clear();

        this.processed_map.clear();
        const processed_rows = beatmap_processor.get_all_beatmaps();
        for (const row of processed_rows) {
            this.processed_map.set(row.md5, row);
        }

        await this.process_beatmaps();

        this.initialized = true;
        return true;
    };

    private process_beatmaps = async (): Promise<void> => {
        beatmap_processor.show_on_renderer();

        const to_insert: BeatmapRow[] = [];
        const beatmaps_array = Array.from(this.osu.beatmaps.values())
            // only process beatmaps that we havent processed yet or modified ones
            .filter((b) => {
                const processed = this.processed_map.get(b.md5);
                if (!processed) return true;
                return processed.last_modified != String(b.last_modification_time);
            });

        console.log("[stable] processing", beatmaps_array.length, "beatmaps");
        for (let i = 0; i < beatmaps_array.length; i++) {
            const beatmap = beatmaps_array[i];
            beatmap_processor.update_on_renderer(i, beatmaps_array.length);

            if (!beatmap.md5) {
                continue;
            }

            const last_modified = String(beatmap.last_modification_time);
            const cached = this.processed_map.get(beatmap.md5);

            if (!cached || cached.last_modified != last_modified) {
                const row = await this.process_single_beatmap(beatmap, last_modified);
                if (row) {
                    to_insert.push(row);
                    this.processed_map.set(row.md5, row);
                }
            }
        }

        if (to_insert.length > 0) {
            beatmap_processor.insert_beatmaps(to_insert);
        }

        beatmap_processor.hide_on_renderer();

        let fallback_set_id = -1;

        for (const [id, beatmapset] of this.osu.beatmapsets) {
            const mapped = build_beatmapset(beatmapset);
            const preferred_id = mapped.online_id || id;
            const resolved_id = preferred_id > 0 && !this.beatmapsets.has(preferred_id) ? preferred_id : fallback_set_id--;
            this.beatmapsets.set(resolved_id, { ...mapped, online_id: resolved_id });
        }
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
            const audio_duration = get_audio_duration(audio_location);

            return {
                md5: beatmap.md5,
                last_modified,
                background: background_location,
                audio: audio_location,
                video: "",
                duration: audio_duration > 0 ? audio_duration : (beatmap_properties.Duration ?? 0)
            };
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    get_player_name = (): string => {
        return this.osu.player_name;
    };

    private get_sort_key = (sort: keyof IBeatmapResult): string => {
        switch (sort) {
            case "star_rating":
                return "star";
            case "status":
                return "ranked_status";
            case "online_id":
                return "difficulty_id";
            case "beatmapset_id":
                return "beatmap_id";
            case "last_modified":
                return "last_modification_time";
            default:
                return sort;
        }
    };

    private build_cpp_filter = (options: IBeatmapFilter, md5_list?: string[]): OsuDbFilterProperties => {
        const props: OsuDbFilterProperties = {
            query: options.query || "",
            sort: {
                key: this.get_sort_key(options.sort),
                order: "asc"
            }
        };

        if (options.mode && options.mode != ALL_MODES_KEY) {
            props.mode = gamemode_to_code(options.mode);
        }

        if (options.status && options.status != ALL_STATUS_KEY) {
            const status_code = stable_status_to_code(options.status);
            if (status_code != -1) {
                props.ranked_status = status_code;
            }
        }

        if (options.difficulty_range) {
            props.star_rating = {
                min: options.difficulty_range[0],
                max: options.difficulty_range[1]
            };
        }

        if (md5_list && md5_list.length > 0) {
            props.md5 = md5_list;
        }

        return props;
    };

    private compare_sort_values = (left: unknown, right: unknown): number => {
        if (typeof left == "string") {
            const left_value = left.toLowerCase();
            const right_value = String(right ?? "").toLowerCase();
            return left_value.localeCompare(right_value);
        }

        const left_number = typeof left == "number" ? left : 0;
        const right_number = typeof right == "number" ? right : 0;
        return right_number - left_number;
    };

    private get_minimal_sort_value = (beatmap: OsuDbBeatmapMinimal, sort: keyof IBeatmapResult): unknown => {
        switch (sort) {
            case "title":
                return beatmap.title;
            case "artist":
                return beatmap.artist;
            case "creator":
                return beatmap.creator;
            case "difficulty":
                return beatmap.difficulty;
            case "source":
                return beatmap.source;
            case "tags":
                return beatmap.tags;
            case "star_rating":
                return beatmap.star_rating;
            case "bpm":
                return beatmap.bpm;
            case "length":
                return beatmap.total_time;
            case "ar":
                return beatmap.approach_rate;
            case "cs":
                return beatmap.circle_size;
            case "hp":
                return beatmap.hp_drain;
            case "od":
                return beatmap.overall_difficulty;
            case "last_modified":
                return Number(beatmap.last_modification_time);
            case "online_id":
                return beatmap.difficulty_id;
            case "beatmapset_id":
                return beatmap.beatmap_id;
            default:
                return beatmap.artist;
        }
    };

    private get_cached_all_beatmaps = (sort: keyof IBeatmapResult): string[] => {
        const cached = this.all_beatmaps_sort_cache.get(sort);
        if (cached) {
            return cached;
        }

        const sorted = Array.from(this.osu.beatmaps.values());
        sorted.sort((left, right) => {
            const left_value = this.get_minimal_sort_value(left, sort);
            const right_value = this.get_minimal_sort_value(right, sort);
            return this.compare_sort_values(left_value, right_value);
        });

        const md5_list = sorted.map((beatmap) => beatmap.md5);
        this.all_beatmaps_sort_cache.set(sort, md5_list);
        return md5_list;
    };

    private can_use_cached_all_beatmaps = (options: IBeatmapFilter, target: string): boolean => {
        if (target != ALL_BEATMAPS_KEY) {
            return false;
        }

        if (this.temp_beatmaps.size > 0) {
            return false;
        }

        if (options.query) {
            return false;
        }

        if (options.unique) {
            return false;
        }

        if (options.status != ALL_STATUS_KEY) {
            return false;
        }

        if (options.mode != ALL_MODES_KEY) {
            return false;
        }

        if (!options.difficulty_range) {
            return true;
        }

        const [min_difficulty, max_difficulty] = options.difficulty_range;
        if (min_difficulty > DEFAULT_MIN_DIFFICULTY) {
            return false;
        }

        if (max_difficulty < DEFAULT_MAX_DIFFICULTY) {
            return false;
        }

        return true;
    };

    has_beatmap = (md5: string): boolean => {
        return this.temp_beatmaps.has(md5) || this.beatmaps.has(md5) || this.osu.beatmaps.has(md5);
    };

    get_beatmaps = (): IBeatmapResult[] => {
        const output: IBeatmapResult[] = [...this.temp_beatmaps.values(), ...this.beatmaps.values()];

        for (const md5 of this.osu.beatmaps.keys()) {
            if (this.beatmaps.has(md5)) {
                continue;
            }
            const beatmap = this.get_cached_beatmap(md5);
            if (beatmap) {
                output.push(beatmap);
            }
        }

        return output;
    };

    private get_cached_beatmap = (md5: string): IBeatmapResult | undefined => {
        const cached = this.beatmaps.get(md5);
        if (cached) {
            return cached;
        }

        const raw = this.osu.beatmaps.get(md5);
        if (!raw) {
            return undefined;
        }

        const built = build_beatmap(raw, this.processed_map.get(md5));
        this.beatmaps.set(md5, built);
        return built;
    };

    get_beatmap_by_md5 = async (md5: string): Promise<IBeatmapResult | undefined> => {
        return this.temp_beatmaps.get(md5) || this.get_cached_beatmap(md5);
    };

    get_beatmap_by_id = async (id: number): Promise<IBeatmapResult | undefined> => {
        const matched = this.osu_db_parser.filter_by_properties({ difficulty_id: id });
        if (matched.length == 0) {
            return undefined;
        }
        return this.get_beatmap_by_md5(matched[0].md5);
    };

    search_beatmaps = async (options: IBeatmapFilter, target: string = ALL_BEATMAPS_KEY): Promise<ISearchResponse> => {
        const target_md5s = target != ALL_BEATMAPS_KEY ? (this.collections.get(target)?.beatmaps ?? []) : undefined;
        if (target != ALL_BEATMAPS_KEY && (!target_md5s || target_md5s.length == 0)) {
            return { beatmaps: [], invalid: [] };
        }

        if (this.can_use_cached_all_beatmaps(options, target)) {
            const cached = this.get_cached_all_beatmaps(options.sort);
            return {
                beatmaps: cached.map((md5) => ({ md5 })),
                invalid: []
            };
        }

        if (target != ALL_BEATMAPS_KEY) {
            const scoped_md5s = target_md5s ?? [];
            const unique_ids = new Set<string>();
            const valid_beatmaps: IBeatmapResult[] = [];
            const invalid_beatmaps: string[] = [];
            const parsed_query = parse_query(options.query ?? "");

            for (const checksum of scoped_md5s) {
                const beatmap = await this.get_beatmap_by_md5(checksum);
                if (!beatmap) {
                    invalid_beatmaps.push(checksum);
                    continue;
                }

                const unique_id = beatmap.unique_id ? beatmap.unique_id : `${beatmap.beatmapset_id}_${beatmap.audio ?? "unknown"}`;
                if (options.unique && unique_ids.has(unique_id)) {
                    continue;
                }

                if (!this.filter_beatmap(beatmap, parsed_query, options)) {
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
        }

        const props = this.build_cpp_filter(options, target_md5s);
        const filtered = this.osu_db_parser.filter_by_properties(props);
        const valid_ids: { md5: string }[] = [];
        const included_md5 = new Set<string>();

        if (options.unique) {
            const seen_unique = new Set<string>();
            for (const beatmap of filtered) {
                if (!beatmap?.md5) {
                    continue;
                }

                const unique_id = `${beatmap.beatmap_id}_${beatmap.audio_file_name ?? ""}`;
                if (seen_unique.has(unique_id)) {
                    continue;
                }

                seen_unique.add(unique_id);
                included_md5.add(beatmap.md5);
                valid_ids.push({ md5: beatmap.md5 });
            }
        } else {
            for (const beatmap of filtered) {
                if (!beatmap?.md5) {
                    continue;
                }

                included_md5.add(beatmap.md5);
                valid_ids.push({ md5: beatmap.md5 });
            }
        }

        for (const [md5, beatmap] of this.temp_beatmaps) {
            if (included_md5.has(md5)) {
                continue;
            }

            if (!matches_temp_query(beatmap, options.query)) {
                continue;
            }

            included_md5.add(md5);
            valid_ids.push({ md5 });
        }

        const invalid = target_md5s ? target_md5s.filter((md5) => !included_md5.has(md5)) : [];
        return { beatmaps: valid_ids, invalid };
    };

    delete_beatmap = async (options: { md5: string; collection?: string }): Promise<boolean> => {
        if (options.collection) {
            return this.remove_beatmap_from_collection(options.collection, options.md5);
        }

        this.osu.beatmaps.delete(options.md5);
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
        this.osu.beatmaps.clear();
        this.osu.beatmapsets.clear();
        this.osu_db_parser?.free();
        this.collection_db_parser?.free();
    };
}

export const stable_client = new StableBeatmapClient();
