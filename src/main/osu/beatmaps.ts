import { BeatmapSetResult, IBeatmapResult, StarRatingFilter } from "@shared/types";
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

const FILTER_REGEX = /\b(?<key>\w+)(?<op>==|!?[:=]|[><][:=]?)(?<value>(".*?"|\S+))/g;
const QUERY_CACHE_MAX_SIZE = 500;
const FILTER_OPERATOR_TOKENS = [":", "=", ">", "<", "!"];
const parsed_query_cache = new Map<string, ParsedQuery>();
const searchable_beatmap_cache = new WeakMap<IBeatmapResult, string>();
const normalized_text_cache = new Map<string, string>();

export interface AdvancedFilter<K extends keyof IBeatmapResult = keyof IBeatmapResult> {
    k: K;
    o: string;
    v: string;
}

export interface ParsedQuery {
    text: string;
    filters: AdvancedFilter[];
}

const save_parsed_query_cache = (raw: string, parsed: ParsedQuery): ParsedQuery => {
    if (parsed_query_cache.size >= QUERY_CACHE_MAX_SIZE) {
        const first_key = parsed_query_cache.keys().next().value;

        if (first_key) {
            parsed_query_cache.delete(first_key);
        }
    }

    parsed_query_cache.set(raw, parsed);
    return parsed;
};

const has_filter_operator = (raw: string): boolean => {
    for (const token of FILTER_OPERATOR_TOKENS) {
        if (raw.includes(token)) {
            return true;
        }
    }

    return false;
};

export const parse_query = (raw: string): ParsedQuery => {
    const cached = parsed_query_cache.get(raw);

    if (cached) {
        return cached;
    }

    const trimmed_raw = raw.trim();

    if (trimmed_raw == "") {
        return save_parsed_query_cache(raw, { text: "", filters: [] });
    }

    if (!has_filter_operator(trimmed_raw)) {
        return save_parsed_query_cache(raw, { text: trimmed_raw.toLowerCase(), filters: [] });
    }

    const filters: AdvancedFilter[] = [];
    let text = raw;

    for (const match of raw.matchAll(FILTER_REGEX)) {
        const { key, op, value } = match.groups!;
        const normalized_key = key.toLowerCase();
        const mapped_key = FILTER_KEY_ALIASES[normalized_key];

        // treat unknown keys as plain text
        if (!mapped_key) {
            text = text.replace(match[0], value.replace(/"/g, ""));
            continue;
        }

        filters.push({
            k: mapped_key,
            o: op,
            v: value.replace(/"/g, "")
        });
        text = text.replace(match[0], "");
    }

    return save_parsed_query_cache(raw, { text: text.trim().toLowerCase(), filters });
};

const validate_filter = (beatmap: IBeatmapResult, filter: AdvancedFilter): boolean => {
    const field = beatmap[filter.k];
    if (field == undefined) return false;

    const operator = normalize_operator(filter.o);

    if (typeof field == "number") {
        return evaluate_numeric_filter(field, filter.v, operator);
    }

    return evaluate_text_filter(filter.k, String(field), filter.v, operator);
};

const normalize_operator = (operator: string): string => {
    if (operator == ":" || operator == "==") return "=";
    if (operator == "!:") return "!=";
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

    if (key == "status") {
        const status_values = filter_val
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v.length > 0);

        if (status_values.length > 1) {
            if (operator == "=") return status_values.includes(field_val);
            if (operator == "!=") return !status_values.includes(field_val);
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

    if (key == "mode") {
        return MODE_ALIASES[normalized] ?? normalized;
    }

    if (key == "status") {
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

    if (query.filters.length == 0 && !query.text) {
        return true;
    }

    for (const filter of query.filters) {
        // skip filters with empty values
        if (!filter.v) continue;
        if (!validate_filter(beatmap, filter)) return false;
    }

    if (!query.text) {
        return true;
    }

    const searchable = get_searchable_beatmap_text(beatmap);
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
    const cached = normalized_text_cache.get(text);
    if (cached) return cached;

    const normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    if (normalized_text_cache.size >= QUERY_CACHE_MAX_SIZE) {
        const first_key = normalized_text_cache.keys().next().value;

        if (first_key) {
            normalized_text_cache.delete(first_key);
        }
    }

    normalized_text_cache.set(text, normalized);
    return normalized;
};

const get_searchable_beatmap_text = (beatmap: IBeatmapResult): string => {
    const cached = searchable_beatmap_cache.get(beatmap);

    if (cached) {
        return cached;
    }

    const tags = Array.isArray(beatmap.tags) ? beatmap.tags.join(" ") : (beatmap.tags ?? "");
    const searchable = normalize_text(`${beatmap.artist} ${beatmap.title} ${beatmap.difficulty} ${beatmap.creator} ${tags}`);

    searchable_beatmap_cache.set(beatmap, searchable);
    return searchable;
};

const compare_values = (a_raw: unknown, b_raw: unknown): number => {
    if (typeof a_raw == "string") {
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
