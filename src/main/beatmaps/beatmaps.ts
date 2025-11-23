import { BeatmapSetResult, IBeatmapResult, IStableTimingPoint, StarRatingFilter } from "@shared/types";
import { config } from "../database/config";

import path from "path";

export const MAX_STAR_RATING_VALUE = 10;
export const ALLOWED_SORT_KEYS = ["title", "artist", "duration", "length", "ar", "cs", "od", "hp"];
export const cached_beatmaps: Map<string, IBeatmapResult> = new Map();
export const cached_beatmapsets: Map<number, BeatmapSetResult> = new Map();

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

const normalize_key = (v: string) => {
    if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1);
    }

    const value = Number(v);
    return isNaN(value) ? v : value;
};

const validate_advanced_filter = <K extends keyof IBeatmapResult>(obj: IBeatmapResult, key: K, op: string, rawValue: string): boolean => {
    const field = obj[key];
    let value: any = rawValue;

    if (typeof field === "number") {
        value = Number(rawValue);
        if (isNaN(value)) return false;
    } else {
        value = String(rawValue).toLowerCase();
    }

    if (field == undefined || value == undefined) {
        return true;
    }

    switch (op) {
        case "=":
            return field == value;
        case "!=":
            return field != value;
        case ">":
            return field > value;
        case ">=":
            return field >= value;
        case "<":
            return field < value;
        case "<=":
            return field <= value;
        default:
            return false;
    }
};

export interface AdvancedFilter<K extends keyof IBeatmapResult = keyof IBeatmapResult> {
    text: string;
    k: K;
    o: string;
    v: string;
}

// filter beatmap based on query and search filters
export const filter_beatmap_by_query = (beatmap: IBeatmapResult, query: string) => {
    let valid = true;

    if (!beatmap) {
        return false;
    }

    const artist = beatmap.artist;
    const title = beatmap.title;
    const difficulty = beatmap.difficulty;
    const creator = beatmap.creator;
    const tags = beatmap.tags;
    const searchable_text = `${artist} ${title} ${difficulty} ${creator} ${tags}`.toLowerCase();

    // attempt to get advanced filters ex:
    // "property=something"
    const advanced_filters: AdvancedFilter[] = [];
    const regex = /\b(?<key>\w+)(?<op>!?[:=]|[><][:=]?)(?<value>(".*?"|\S+))/g;

    for (const match of query.matchAll(regex)) {
        const groups = match.groups;
        if (!groups) continue;

        const { key, op, value } = groups;
        advanced_filters.push({ text: match[0], k: key as keyof IBeatmapResult, o: op, v: value.replace(/"/g, "") });
    }

    // remove the advanced filters from query so the query only reflects basic stuff
    for (const filter of advanced_filters) {
        query = query.replace(filter.text, "");
    }

    // check if advanced filters block the current search
    for (const filter of advanced_filters) {
        const normalized = normalize_key(filter.v);

        // ignore invalid filters
        if (!normalized) {
            continue;
        }

        if (!validate_advanced_filter(beatmap, filter.k, filter.o, filter.v)) {
            valid = false;
            break;
        }
    }

    return valid && (query == "" || searchable_text.includes(query));
};

const normalize_text = (text: string) => {
    if (!text) {
        return "";
    }

    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

// sort beatmaps by type (descending)
export const sort_beatmaps = (beatmaps: IBeatmapResult[], property: keyof IBeatmapResult) => {
    if (!ALLOWED_SORT_KEYS.includes(property)) {
        return beatmaps;
    }

    const result = beatmaps.sort((a, b) => {
        // yeah, threat everything that isnt number as string...
        const is_text_comparission = typeof property != "number";

        if (is_text_comparission) {
            const a_val = normalize_text(String(a[property]));
            const b_val = normalize_text(String(b[property]));

            // push empty/invalid values to the end
            if (!a_val && b_val) return 1;
            if (a_val && !b_val) return -1;
            if (!a_val && !b_val) return 0;

            return a_val.localeCompare(b_val);
        } else {
            const a_val = a[property] || 0;
            const b_val = b[property] || 0;

            // push null/undefined values to the end
            if ((a_val == null || a_val == undefined) && b_val != null && b_val != undefined) return 1;
            if (a_val != null && a_val != undefined && (b_val == null || b_val == undefined)) return -1;
            if ((a_val == null || a_val == undefined) && (b_val == null || b_val == undefined)) return 0;

            return b_val - a_val;
        }
    });

    return result;
};

// sort beatmapsets by type (descending)
export const sort_beatmapset = (beatmaps: BeatmapSetResult[], property: keyof BeatmapSetResult["metadata"]) => {
    if (!ALLOWED_SORT_KEYS.includes(property)) {
        return beatmaps;
    }

    const result = beatmaps.sort((a, b) => {
        // yeah, threat everything that isnt number as string...
        const is_text_comparission = typeof property != "number";

        if (is_text_comparission) {
            const a_val = normalize_text(String(a[property]));
            const b_val = normalize_text(String(b[property]));

            // push empty/invalid values to the end
            if (!a_val && b_val) return 1;
            if (a_val && !b_val) return -1;
            if (!a_val && !b_val) return 0;

            return a_val.localeCompare(b_val);
        } else {
            const a_val = a[property] || 0;
            const b_val = b[property] || 0;

            // push null/undefined values to the end
            if ((a_val == null || a_val == undefined) && b_val != null && b_val != undefined) return 1;
            if (a_val != null && a_val != undefined && (b_val == null || b_val == undefined)) return -1;
            if ((a_val == null || a_val == undefined) && (b_val == null || b_val == undefined)) return 0;

            return b_val - a_val;
        }
    });

    return result;
};

export const check_beatmap_difficulty = (beatmap: IBeatmapResult, diff: StarRatingFilter) => {
    const min_val = diff[0];
    const max_val = diff[1];

    if (min_val != null && beatmap.star_rating < min_val) return false;
    if (max_val != null && max_val != MAX_STAR_RATING_VALUE && beatmap.star_rating > max_val) return false;

    return true;
};

export const get_lazer_file_location = (name: string) => {
    if (!name) return "";
    const lazer_files_path = path.resolve(config.get().lazer_path, "files");
    return path.resolve(lazer_files_path, `${name.substring(0, 1)}/${name.substring(0, 2)}/${name}`);
};
