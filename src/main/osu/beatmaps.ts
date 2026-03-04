import { BeatmapSetResult, IBeatmapResult, IStableTimingPoint, StarRatingFilter } from "@shared/types";
import { config } from "../database/config";

import path from "path";

export const MAX_STAR_RATING_VALUE = 10;
export const ALLOWED_SORT_KEYS = ["title", "artist", "duration", "length", "ar", "cs", "od", "hp"];
const FILTER_KEY_ALIASES: Record<string, keyof IBeatmapResult> = {
    artist: "artist",
    creator: "creator",
    author: "creator",
    mapper: "creator",
    title: "title",
    difficulty: "difficulty",
    diff: "difficulty",
    source: "source",
    tag: "tags",
    tags: "tags",
    ar: "ar",
    cs: "cs",
    od: "od",
    hp: "hp",
    dr: "hp",
    star: "star_rating",
    stars: "star_rating",
    sr: "star_rating",
    bpm: "bpm",
    length: "length",
    mode: "mode",
    status: "status"
};

const MODE_ALIASES: Record<string, string> = {
    osu: "osu",
    taiko: "taiko",
    catch: "fruits",
    fruits: "fruits",
    mania: "mania"
};

const STATUS_ALIASES: Record<string, string> = {
    ranked: "ranked",
    approved: "approved",
    pending: "pending",
    notsubmitted: "unknown",
    unknown: "unknown",
    loved: "loved"
};

// https://github.com/ppy/osu/blob/775cdc087eda5c1525d763c6fa3d422db0e93f66/osu.Game/Beatmaps/Beatmap.cs#L81
export const get_common_bpm = (timing_points: IStableTimingPoint[], length: number) => {
    if (!timing_points || timing_points?.length == 0) {
        return 0;
    }

    const beat_length_map = new Map();
    const last_time = length > 0 ? length : timing_points[timing_points.length - 1].offset;

    for (let i = 0; i < timing_points.length; i++) {
        const point = timing_points[i];

        if (point.offset > last_time) {
            continue;
        }

        const bpm = Math.round((60000 / point.beat_length) * 1000) / 1000;
        const current_time = i == 0 ? 0 : point.offset;
        const next_time = i == timing_points.length - 1 ? last_time : timing_points[i + 1].offset;
        const duration = next_time - current_time;

        beat_length_map.set(bpm, (beat_length_map.get(bpm) || 0) + duration);
    }

    return [...beat_length_map.entries()].reduce((max, [bpm, duration]) => (duration > max.duration ? { bpm, duration } : max), {
        bpm: 0,
        duration: 0
    }).bpm;
};

const FILTER_REGEX = /\b(?<key>\w+)(?<op>==|!?[:=]|[><][:=]?)(?<value>(".*?"|\S+))/g;

export interface AdvancedFilter<K extends keyof IBeatmapResult = keyof IBeatmapResult> {
    k: K;
    o: string;
    v: string;
}

export interface ParsedQuery {
    text: string;
    filters: AdvancedFilter[];
}

export const parse_query = (raw: string): ParsedQuery => {
    const filters: AdvancedFilter[] = [];
    let text = raw;

    for (const match of raw.matchAll(FILTER_REGEX)) {
        const { key, op, value } = match.groups!;
        const normalized_key = key.toLowerCase();
        const mapped_key = FILTER_KEY_ALIASES[normalized_key];

        // treat unknown keys as plain text
        if (!mapped_key) {
            continue;
        }

        filters.push({
            k: mapped_key,
            o: op,
            v: value.replace(/"/g, "")
        });
        text = text.replace(match[0], "");
    }

    return { text: text.trim().toLowerCase(), filters };
};

const validate_filter = (beatmap: IBeatmapResult, filter: AdvancedFilter): boolean => {
    const field = beatmap[filter.k];
    if (field == undefined) return false;

    const operator = normalize_operator(filter.o);

    if (typeof field === "number") {
        return evaluate_numeric_filter(field, filter.v, operator);
    }

    return evaluate_text_filter(filter.k, String(field), filter.v, operator);
};

const normalize_operator = (operator: string): string => {
    if (operator === ":" || operator === "==") return "=";
    if (operator === "!:") return "!=";
    return operator;
};

const evaluate_numeric_filter = (field: number, value: string, operator: string): boolean => {
    const target = Number(value);

    if (Number.isNaN(target)) {
        return false;
    }

    switch (operator) {
        case "=":
            return field == target;
        case "!=":
            return field != target;
        case ">":
            return field > target;
        case ">=":
            return field >= target;
        case "<":
            return field < target;
        case "<=":
            return field <= target;
        default:
            return false;
    }
};

const evaluate_text_filter = (key: keyof IBeatmapResult, field: string, value: string, operator: string): boolean => {
    const field_val = normalize_text(normalize_filter_value(key, field));
    const filter_val = normalize_text(normalize_filter_value(key, value));

    if (key === "status") {
        const status_values = filter_val
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v.length > 0);

        if (status_values.length > 1) {
            if (operator === "=") return status_values.includes(field_val);
            if (operator === "!=") return !status_values.includes(field_val);
            return false;
        }
    }

    switch (operator) {
        case "=":
            return field_val == filter_val;
        case "!=":
            return field_val != filter_val;
        case ">":
            return field_val > filter_val;
        case ">=":
            return field_val >= filter_val;
        case "<":
            return field_val < filter_val;
        case "<=":
            return field_val <= filter_val;
        default:
            return false;
    }
};

const normalize_filter_value = (key: keyof IBeatmapResult, value: string): string => {
    const normalized = value.toLowerCase();

    if (key === "mode") {
        return MODE_ALIASES[normalized] ?? normalized;
    }

    if (key === "status") {
        if (normalized.includes(",")) {
            return normalized
                .split(",")
                .map((v) => STATUS_ALIASES[v.trim()] ?? v.trim())
                .join(",");
        }

        return STATUS_ALIASES[normalized] ?? normalized;
    }

    return value;
};

export const matches_beatmap = (beatmap: IBeatmapResult, query: ParsedQuery): boolean => {
    if (!beatmap) {
        return false;
    }

    for (const filter of query.filters) {
        // skip filters with empty values
        if (!filter.v) continue;
        if (!validate_filter(beatmap, filter)) return false;
    }

    if (!query.text) {
        return true;
    }

    const tags = Array.isArray(beatmap.tags) ? beatmap.tags.join(" ") : (beatmap.tags ?? "");
    const searchable = normalize_text(`${beatmap.artist} ${beatmap.title} ${beatmap.difficulty} ${beatmap.creator} ${tags}`);
    const query_text = normalize_text(query.text);

    return searchable.includes(query_text);
};

export const check_beatmap_difficulty = (beatmap: IBeatmapResult, diff: StarRatingFilter): boolean => {
    const [min_val, max_val] = diff;

    if (min_val != null && beatmap.star_rating < min_val) return false;
    if (max_val != null && max_val != MAX_STAR_RATING_VALUE && beatmap.star_rating > max_val) return false;

    return true;
};

const normalize_text = (text: string): string => {
    if (!text) return "";
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

const compare_values = (a_raw: unknown, b_raw: unknown): number => {
    if (typeof a_raw === "string") {
        const a = normalize_text(a_raw);
        const b = normalize_text(String(b_raw ?? ""));

        if (!a && b) return 1;
        if (a && !b) return -1;
        if (!a && !b) return 0;

        return a.localeCompare(b);
    }

    const a = (a_raw as number) ?? null;
    const b = (b_raw as number) ?? null;

    if (a == null && b != null) return 1;
    if (a != null && b == null) return -1;
    if (a == null && b == null) return 0;

    return (b as number) - (a as number);
};

export const sort_beatmaps = (beatmaps: IBeatmapResult[], property: keyof IBeatmapResult): IBeatmapResult[] => {
    if (!ALLOWED_SORT_KEYS.includes(property)) return beatmaps;
    return beatmaps.sort((a, b) => compare_values(a[property], b[property]));
};

export const sort_beatmapset = (beatmaps: BeatmapSetResult[], property: keyof BeatmapSetResult["metadata"]): BeatmapSetResult[] => {
    if (!ALLOWED_SORT_KEYS.includes(property)) return beatmaps;
    return beatmaps.sort((a, b) => compare_values(a.metadata[property], b.metadata[property]));
};

export const get_lazer_file_location = (name: string) => {
    if (!name || name == "") return "";
    const lazer_files_path = path.resolve(config.get().lazer_path, "files");
    return path.resolve(lazer_files_path, `${name.substring(0, 1)}/${name.substring(0, 2)}/${name}`);
};
