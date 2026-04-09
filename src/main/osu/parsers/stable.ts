import { gamemode_from_code, stable_status_from_code, type IBeatmapResult } from "@shared/types";
import { check_beatmap_difficulty, matches_beatmap, parse_query } from "../beatmaps";
import { BinaryReader } from "./binary_reader";

import fs from "fs";

const NEW_STAR_RATING_VERSION = 20250107;
const OLD_AR_CS_HP_OD_VERSION = 20140609;
const ENTRY_SIZE_VERSION = 20191106;
const DEFAULT_BPM = 0;
const DEFAULT_MAX_STARS = 10;

type Order = "asc" | "desc";

export type NumberRange = {
    min?: number;
    max?: number;
};

export interface OsuDbBeatmapMinimal {
    md5: string;
    beatmap_id: number;
    difficulty_id: number;
    title: string;
    artist: string;
    creator: string;
    difficulty: string;
    source: string;
    tags: string;
    mode: number;
    ranked_status: number;
    total_time: number;
    duration: number | null;
    last_modification_time: bigint;
    approach_rate: number;
    circle_size: number;
    hp_drain: number;
    overall_difficulty: number;
    bpm: number;
    star_rating: number;
    folder_name: string;
    osu_file_name: string;
    audio_file_name: string;
}

export interface OsuDbFilterProperties {
    query?: string;
    mode?: number | number[];
    ranked_status?: number | number[];
    beatmap_id?: number | number[];
    difficulty_id?: number | number[];
    md5?: string | string[];
    star_rating?: NumberRange;
    total_time?: NumberRange;
    ar?: NumberRange;
    cs?: NumberRange;
    hp?: NumberRange;
    od?: NumberRange;
    sort?: {
        key: string;
        order?: Order;
    };
}

export interface OsuDbHeader {
    version: number;
    folder_count: number;
    account_unlocked: number;
    account_unlock_time: bigint;
    player_name: string;
    beatmaps_count: number;
    permissions: number;
}

export interface OsuCollection {
    name: string;
    beatmaps_count: number;
    beatmap_md5: string[];
}

export interface OsuCollectionDb {
    version: number;
    collections_count: number;
    collections: OsuCollection[];
}

const EXACT_FILTER_MAP: Record<string, keyof OsuDbBeatmapMinimal> = {
    mode: "mode",
    ranked_status: "ranked_status",
    beatmap_id: "beatmap_id",
    difficulty_id: "difficulty_id",
    md5: "md5"
};

const RANGE_FILTER_MAP: Record<string, keyof OsuDbBeatmapMinimal> = {
    star_rating: "star_rating",
    total_time: "total_time",
    ar: "approach_rate",
    cs: "circle_size",
    hp: "hp_drain",
    od: "overall_difficulty"
};

const SORT_KEY_MAP: Record<string, keyof OsuDbBeatmapMinimal> = {
    star: "star_rating",
    ranked_status: "ranked_status",
    difficulty_id: "difficulty_id",
    beatmap_id: "beatmap_id",
    last_modification_time: "last_modification_time",
    title: "title",
    artist: "artist",
    creator: "creator",
    difficulty: "difficulty",
    source: "source",
    tags: "tags",
    bpm: "bpm",
    total_time: "total_time",
    approach_rate: "approach_rate",
    circle_size: "circle_size",
    hp_drain: "hp_drain",
    overall_difficulty: "overall_difficulty"
};

const matches_exact = <T>(value: T, filter: T | T[] | undefined): boolean => {
    if (filter == undefined) {
        return true;
    }

    if (Array.isArray(filter)) {
        return filter.includes(value);
    }

    return value == filter;
};

const matches_range = (value: number, range: NumberRange | undefined): boolean => {
    if (!range) {
        return true;
    }

    if (range.min != null && value < range.min) {
        return false;
    }

    if (range.max != null && value > range.max) {
        return false;
    }

    return true;
};

const compare_values = (left_raw: unknown, right_raw: unknown, order: Order): number => {
    let result = 0;

    if (typeof left_raw == "string") {
        const left = left_raw.toLowerCase();
        const right = String(right_raw ?? "").toLowerCase();
        result = left.localeCompare(right);
    } else {
        const left = typeof left_raw == "bigint" ? Number(left_raw) : Number(left_raw ?? 0);
        const right = typeof right_raw == "bigint" ? Number(right_raw) : Number(right_raw ?? 0);
        result = right - left;
    }

    return order == "desc" ? result * -1 : result;
};

const get_common_bpm = (timing_points: Array<{ beat_length: number; offset: number; inherited: boolean }>, length: number): number => {
    if (timing_points.length == 0) {
        return DEFAULT_BPM;
    }

    const duration_by_bpm = new Map<number, number>();
    const last_time = length > 0 ? length : timing_points[timing_points.length - 1].offset;

    for (let index = 0; index < timing_points.length; index++) {
        const point = timing_points[index];

        if (point.offset > last_time) {
            continue;
        }

        if (!point.inherited || point.beat_length <= 0) {
            continue;
        }

        const bpm = Math.round((60000 / point.beat_length) * 1000) / 1000;
        const current_time = index == 0 ? 0 : point.offset;
        const next_time = index == timing_points.length - 1 ? last_time : timing_points[index + 1].offset;
        const duration = Math.max(0, next_time - current_time);

        const previous = duration_by_bpm.get(bpm) ?? 0;
        duration_by_bpm.set(bpm, previous + duration);
    }

    let result = DEFAULT_BPM;
    let max_duration = -1;

    for (const [bpm, duration] of duration_by_bpm) {
        if (duration > max_duration) {
            max_duration = duration;
            result = bpm;
        }
    }

    return result;
};

const to_filter_beatmap = (beatmap: OsuDbBeatmapMinimal): IBeatmapResult => {
    return {
        md5: beatmap.md5,
        online_id: beatmap.difficulty_id,
        beatmapset_id: beatmap.beatmap_id,
        title: beatmap.title,
        artist: beatmap.artist,
        creator: beatmap.creator,
        difficulty: beatmap.difficulty,
        source: beatmap.source,
        tags: beatmap.tags,
        ar: beatmap.approach_rate,
        cs: beatmap.circle_size,
        hp: beatmap.hp_drain,
        od: beatmap.overall_difficulty,
        star_rating: beatmap.star_rating,
        bpm: beatmap.bpm,
        length: beatmap.total_time,
        status: stable_status_from_code(beatmap.ranked_status),
        mode: gamemode_from_code(beatmap.mode),
        temp: false,
        last_modified: String(beatmap.last_modification_time),
        background: ""
    };
};

const build_exact_predicates = (properties: OsuDbFilterProperties): Array<(beatmap: OsuDbBeatmapMinimal) => boolean> => {
    const predicates: Array<(beatmap: OsuDbBeatmapMinimal) => boolean> = [];

    for (const [property_key, beatmap_key] of Object.entries(EXACT_FILTER_MAP)) {
        const filter_value = properties[property_key as keyof OsuDbFilterProperties] as number | string | number[] | string[] | undefined;

        if (filter_value == undefined) {
            continue;
        }

        predicates.push((beatmap) => {
            const value = beatmap[beatmap_key] as number | string;
            return matches_exact(value, filter_value as number | string | Array<number | string>);
        });
    }

    return predicates;
};

const build_range_predicates = (properties: OsuDbFilterProperties): Array<(beatmap: OsuDbBeatmapMinimal) => boolean> => {
    const predicates: Array<(beatmap: OsuDbBeatmapMinimal) => boolean> = [];

    for (const [property_key, beatmap_key] of Object.entries(RANGE_FILTER_MAP)) {
        const range = properties[property_key as keyof OsuDbFilterProperties] as NumberRange | undefined;

        if (!range) {
            continue;
        }

        predicates.push((beatmap) => {
            const value = Number(beatmap[beatmap_key] ?? 0);
            return matches_range(value, range);
        });
    }

    return predicates;
};

export class OsuDbParser extends BinaryReader {
    private header: OsuDbHeader = {
        version: 0,
        folder_count: 0,
        account_unlocked: 0,
        account_unlock_time: 0n,
        player_name: "",
        beatmaps_count: 0,
        permissions: 0
    };

    private beatmaps: OsuDbBeatmapMinimal[] = [];

    parse = async (location: string): Promise<this> => {
        const buffer = fs.readFileSync(location);
        this.set_buffer(buffer);

        const version = this.int();
        const folder_count = this.int();
        const account_unlocked = this.byte();
        const account_unlock_time = this.long();
        const player_name = this.osu_string();
        const beatmaps_count = this.int();

        const beatmaps: OsuDbBeatmapMinimal[] = [];

        for (let index = 0; index < beatmaps_count; index++) {
            beatmaps.push(this.read_beatmap(version));
        }

        const permissions = this.int();

        this.header = {
            version,
            folder_count,
            account_unlocked,
            account_unlock_time,
            player_name,
            beatmaps_count,
            permissions
        };

        this.beatmaps = beatmaps;
        return this;
    };

    private read_beatmap = (version: number): OsuDbBeatmapMinimal => {
        if (version < ENTRY_SIZE_VERSION) {
            this.int();
        }

        const artist = this.osu_string();
        this.osu_string();
        const title = this.osu_string();
        this.osu_string();
        const creator = this.osu_string();
        const difficulty = this.osu_string();
        const audio_file_name = this.osu_string();
        const md5 = this.osu_string();
        const osu_file_name = this.osu_string();
        const ranked_status = this.byte(true);

        this.short();
        this.short();
        this.short();

        const last_modification_time = this.long();
        const use_old_stats = version < OLD_AR_CS_HP_OD_VERSION;

        const approach_rate = use_old_stats ? this.byte() : this.single();
        const circle_size = use_old_stats ? this.byte() : this.single();
        const hp_drain = use_old_stats ? this.byte() : this.single();
        const overall_difficulty = use_old_stats ? this.byte() : this.single();

        this.double();

        const star_ratings = this.read_star_rating_groups(version);
        this.int();
        const total_time = this.int();
        this.int();

        const timing_points_count = this.int();
        const timing_points: Array<{ beat_length: number; offset: number; inherited: boolean }> = [];

        for (let index = 0; index < timing_points_count; index++) {
            timing_points.push({
                beat_length: this.double(),
                offset: this.double(),
                inherited: this.bool()
            });
        }

        const difficulty_id = this.int();
        const beatmap_id = this.int();

        this.int();
        this.byte();
        this.byte();
        this.byte();
        this.byte();
        this.short();
        this.single();

        const mode = this.byte();
        const source = this.osu_string();
        const tags = this.osu_string();

        this.short();
        this.osu_string();
        this.bool();
        this.long();
        this.bool();

        const folder_name = this.osu_string();

        this.long();
        this.bool();
        this.bool();
        this.bool();
        this.bool();
        this.bool();

        if (version < OLD_AR_CS_HP_OD_VERSION) {
            this.short();
        }

        this.int();
        this.byte();

        const mode_index = mode >= 0 && mode < star_ratings.length ? mode : 0;

        return {
            md5,
            beatmap_id,
            difficulty_id,
            title,
            artist,
            creator,
            difficulty,
            source,
            tags,
            mode,
            ranked_status,
            total_time,
            duration: null,
            last_modification_time,
            approach_rate,
            circle_size,
            hp_drain,
            overall_difficulty,
            bpm: get_common_bpm(timing_points, total_time),
            star_rating: star_ratings[mode_index] ?? 0,
            folder_name,
            osu_file_name,
            audio_file_name
        };
    };

    private read_star_rating_groups = (version: number): number[] => {
        const result = [0, 0, 0, 0];
        const is_new_version = version >= NEW_STAR_RATING_VERSION;

        for (let mode = 0; mode < 4; mode++) {
            const count = this.int();
            let fallback = 0;

            for (let index = 0; index < count; index++) {
                this.byte();
                const mod_combination = this.int();
                this.byte();
                const star_rating = is_new_version ? this.single() : this.double();

                if (index == 0) {
                    fallback = star_rating;
                }

                if (mod_combination == 0) {
                    result[mode] = star_rating;
                }
            }

            if (result[mode] == 0) {
                result[mode] = fallback;
            }
        }

        return result;
    };

    get = (): OsuDbHeader & { beatmaps: OsuDbBeatmapMinimal[] } => {
        return {
            ...this.header,
            beatmaps: [...this.beatmaps]
        };
    };

    get_header = (): OsuDbHeader => {
        return { ...this.header };
    };

    get_minimal_list = (): OsuDbBeatmapMinimal[] => {
        return [...this.beatmaps];
    };

    filter_by_properties = (properties: OsuDbFilterProperties): OsuDbBeatmapMinimal[] => {
        const parsed_query = parse_query(properties.query ?? "");
        const has_query = parsed_query.text.length > 0 || parsed_query.filters.length > 0;

        const exact_predicates = build_exact_predicates(properties);
        const range_predicates = build_range_predicates(properties);

        const filtered: OsuDbBeatmapMinimal[] = [];

        for (const beatmap of this.beatmaps) {
            let should_include = true;

            for (const predicate of exact_predicates) {
                if (!predicate(beatmap)) {
                    should_include = false;
                    break;
                }
            }

            if (!should_include) {
                continue;
            }

            for (const predicate of range_predicates) {
                if (!predicate(beatmap)) {
                    should_include = false;
                    break;
                }
            }

            if (!should_include) {
                continue;
            }

            if (!has_query) {
                filtered.push(beatmap);
                continue;
            }

            const query_beatmap = to_filter_beatmap(beatmap);

            if (!matches_beatmap(query_beatmap, parsed_query)) {
                continue;
            }

            if (!check_beatmap_difficulty(query_beatmap, [properties.star_rating?.min ?? 0, properties.star_rating?.max ?? DEFAULT_MAX_STARS])) {
                continue;
            }

            filtered.push(beatmap);
        }

        const sort_key = SORT_KEY_MAP[properties.sort?.key ?? ""];
        if (!sort_key) {
            return filtered;
        }

        const sort_order = properties.sort?.order ?? "asc";

        return filtered.sort((left, right) => {
            return compare_values(left[sort_key], right[sort_key], sort_order);
        });
    };

    update = (_patch: unknown): this => {
        return this;
    };

    write = async (): Promise<void> => {
        return;
    };

    free = (): void => {
        this.set_buffer(Buffer.alloc(0));
        this.header = {
            version: 0,
            folder_count: 0,
            account_unlocked: 0,
            account_unlock_time: 0n,
            player_name: "",
            beatmaps_count: 0,
            permissions: 0
        };
        this.beatmaps = [];
    };
}

export class OsuCollectionDbParser extends BinaryReader {
    private location: string = "";
    private data: OsuCollectionDb = {
        version: 0,
        collections_count: 0,
        collections: []
    };

    parse = async (location: string): Promise<this> => {
        const buffer = fs.readFileSync(location);
        this.set_buffer(buffer);

        const version = this.int();
        const collections_count = this.int();
        const collections: OsuCollection[] = [];

        for (let index = 0; index < collections_count; index++) {
            const name = this.osu_string();
            const beatmaps_count = this.int();
            const beatmap_md5: string[] = [];

            for (let map_index = 0; map_index < beatmaps_count; map_index++) {
                beatmap_md5.push(this.osu_string());
            }

            collections.push({
                name,
                beatmaps_count,
                beatmap_md5
            });
        }

        this.location = location;
        this.data = {
            version,
            collections_count,
            collections
        };

        return this;
    };

    get = (): OsuCollectionDb => {
        return {
            version: this.data.version,
            collections_count: this.data.collections_count,
            collections: this.data.collections.map((collection) => ({
                name: collection.name,
                beatmaps_count: collection.beatmaps_count,
                beatmap_md5: [...collection.beatmap_md5]
            }))
        };
    };

    update = (patch: Partial<OsuCollectionDb>): this => {
        this.data = {
            ...this.data,
            ...patch,
            collections: patch.collections
                ? patch.collections.map((collection) => ({
                      name: collection.name,
                      beatmaps_count: collection.beatmaps_count,
                      beatmap_md5: [...collection.beatmap_md5]
                  }))
                : this.data.collections
        };

        this.data.collections_count = this.data.collections.length;
        return this;
    };

    write = async (): Promise<void> => {
        if (!this.location) {
            throw new Error("collection parser has no target location");
        }

        const chunks: Buffer[] = [];

        chunks.push(this.write_int(this.data.version));
        chunks.push(this.write_int(this.data.collections.length));

        for (const collection of this.data.collections) {
            chunks.push(this.write_osu_string(collection.name));
            chunks.push(this.write_int(collection.beatmap_md5.length));

            for (const md5 of collection.beatmap_md5) {
                chunks.push(this.write_osu_string(md5));
            }
        }

        fs.writeFileSync(this.location, this.join_buffer(chunks));
    };

    free = (): void => {
        this.location = "";
        this.set_buffer(Buffer.alloc(0));
        this.data = {
            version: 0,
            collections_count: 0,
            collections: []
        };
    };
}
