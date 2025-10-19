import { config } from "../database/config";
import { process_beatmaps } from "../database/indexer";
import { reader } from "../reader/reader";
import { beatmap_manager } from "./beatmap_manager.js";

import fs from "fs";
import path from "path";

export const GAMEMODES = ["osu!", "taiko", "ctb", "mania"];
export const MAX_STAR_RATING_VALUE = 10; // lazer

// sort shit
const TEXT_SORT_KEYS = ["title", "artist"];
const NUMBER_SORT_KEYS = ["duration", "length", "ar", "cs", "od", "hp"];

// get nm star rating based on gamemode
export const get_beatmap_sr = (beatmap, gamemode = 0) => {
    try {
        const star_rating = beatmap?.star_rating;

        if (!star_rating || star_rating.length == 0) {
            return Number(0).toFixed(2);
        }

        const result = star_rating[gamemode].pair[1] ?? 0;
        return Number(result).toFixed(2);
    } catch (err) {
        console.log(err);
        return Number(0).toFixed(2);
    }
};

// https://github.com/ppy/osu/blob/775cdc087eda5c1525d763c6fa3d422db0e93f66/osu.Game/Beatmaps/Beatmap.cs#L81
export const get_common_bpm = (timing_points, length) => {
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

const to_type = (v) => {
    if (typeof v == "string" && v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1);
    }

    const value = Number(v);
    return isNaN(value) ? v : value;
};

const renamed_list = new Map([["star", "star_rating"]]);
const get_key = (key) => renamed_list.get(key) || key;

const validate_filter = (key, op, value) => {
    if (key == null) {
        return false;
    }

    switch (op) {
        case "=":
            return key == value;
        case "!=":
            return key != value;
        case ">":
            return key > value;
        case ">=":
            return key >= value;
        case "<":
            return key < value;
        case "<=":
            return key <= value;
        default:
            return true;
    }
};

// filter beatmap based on query and search filters
export const search_filter = (beatmap, query, search_filters) => {
    let valid = true;

    if (beatmap == null) {
        return false;
    }

    const artist = beatmap.artist || "unknown";
    const title = beatmap.title || "unknown";
    const difficulty = beatmap?.difficulty || "unknown";
    const creator = beatmap?.mapper || "unknown";
    const tags = beatmap?.tags || "";
    const searchable_text = `${artist} ${title} ${difficulty} ${creator} ${tags}`.toLowerCase();

    // clean query by removing filter expressions
    let clean_query = query;

    for (const filter of search_filters) {
        clean_query = clean_query.replace(filter.text, "");
    }

    clean_query = clean_query.trim();

    // check text match if theres remaining query
    const text_included = clean_query == "" || searchable_text.includes(clean_query.toLowerCase());

    if (search_filters.length == 0) {
        return text_included;
    }

    for (const filter of search_filters) {
        const thing = to_type(filter.v);

        // ignore invalid filters
        if (!thing || thing == "") {
            continue;
        }

        const key = get_key(filter.k);
        const gamemode = beatmap.mode;

        if (key == "star_rating") {
            const star_rating = beatmap?.[key];

            // shouldn't happen
            // but since i cant trust my shitty ass code
            // check anyways
            if (!star_rating) break;

            // also shouldn't happen...
            const nomod_star_rating = star_rating[gamemode];

            if (!nomod_star_rating) break;

            if (!validate_filter(nomod_star_rating.nm, filter.o, thing)) {
                valid = false;
                break;
            }
        } else {
            if (!validate_filter(beatmap?.[key], filter.o, thing)) {
                valid = false;
                break;
            }
        }
    }

    return valid && text_included;
};

export const filter_beatmap = (beatmap, query) => {
    const search_filters = [];
    const regex = /\b(?<key>\w+)(?<op>!?[:=]|[><][:=]?)(?<value>(".*?"|\S+))/g;

    for (const match of query.matchAll(regex)) {
        const [text, k, o, v] = match;
        search_filters.push({ text, k, o, v });
    }

    // filter by search
    return search_filter(beatmap, query, search_filters);
};

export const get_playername = () => {
    return beatmap_manager.player_name;
};

export const minify_beatmap_result = (result) => {
    return {
        md5: result.md5,
        title: result.title,
        artist: result.artist,
        mapper: result.mapper,
        beatmapset_id: result.beatmapset_id,
        difficulty_id: result.difficulty_id,
        bpm: Math.floor(result?.bpm),
        star_rating: result.star_rating,
        status_text: result.status_text,
        audio_path: result.audio_path,
        image_path: result.image_path,
        mode: result.mode,
        local: result.local,
        duration: result.duration ?? 0,
        unique_id: result.unique_id,
        downloaded: result.downloaded
    };
};

export const get_beatmap_by_md5 = (md5) => {
    const result = beatmap_manager.get_beatmap_by_md5(md5);

    if (!result) {
        return false;
    }

    return minify_beatmap_result(result);
};

export const get_beatmaps_by_id = (id) => {
    return beatmap_manager.get_beatmaps_by_unique_id(id);
};

export const get_beatmap_by_set_id = (id) => {
    const beatmaps = beatmap_manager.get_beatmaps_from_set(id);
    if (beatmaps.length > 0) {
        return minify_beatmap_result(beatmaps[0]);
    }
    return false;
};

export const get_beatmap_data = (id, query, is_unique_id) => {
    const result = { filtered: false, beatmap: null };

    // ignore unknown maps if we dont have a query yet
    if (!id || id == "") {
        result.filtered = true;
        return result;
    }

    if (is_unique_id) {
        const beatmaps = get_beatmaps_by_id(id);
        result.beatmap = beatmaps.length > 0 ? beatmaps[0] : null;
    } else {
        result.beatmap = get_beatmap_by_md5(id);
    }

    // ignore unknown maps if we dont have a query yet
    if (!result.beatmap && query == "") {
        result.beatmap = { [is_unique_id ? "id" : "md5"]: id };
        return result;
    }

    if (query && query != "") {
        const passes_filter = filter_beatmap(result.beatmap, query);
        result.filtered = !passes_filter;
        return result;
    }

    return result;
};

const normalize_text = (text) => {
    if (!text) {
        return "";
    }

    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

// sort beatmaps by type (descending)
export const sort_beatmaps = (beatmaps, type) => {
    if (!TEXT_SORT_KEYS.includes(type) && !NUMBER_SORT_KEYS.includes(type)) {
        return beatmaps;
    }

    const compare_text = (a_val, b_val) => {
        const a_empty = !a_val;
        const b_empty = !b_val;

        if (a_empty || b_empty) {
            return a_empty && b_empty ? 0 : a_empty ? 1 : -1;
        }

        // only normalize if both values exist
        return normalize_text(a_val).localeCompare(normalize_text(b_val));
    };

    const compare_number = (a_val, b_val) => {
        const a_num = Number(a_val) || 0;
        const b_num = Number(b_val) || 0;
        return b_num - a_num;
    };

    const comparator = TEXT_SORT_KEYS.includes(type) ? (a, b) => compare_text(a[type], b[type]) : (a, b) => compare_number(a[type], b[type]);

    return beatmaps.sort(comparator);
};

export const filter_by_sr = (beatmap, min, max) => {
    // ignore unknown beatmaps
    if (!beatmap || typeof beatmap == "string") {
        return true;
    }

    // again
    if (!beatmap?.star_rating || beatmap.star_rating?.length == 0 || isNaN(beatmap.mode)) {
        return true;
    }

    // normalize inputs
    const min_val = min == undefined || min == null ? null : Number(min);
    const max_val = max == undefined || max == null ? null : Number(max);

    // no sr filter
    if (min_val == null && max_val == null) {
        return true;
    }

    // get numeric star rating for the beatmap (based on its mode)
    const sr = Number(get_beatmap_sr(beatmap, beatmap.mode ?? 0));
    if (isNaN(sr)) return true;

    // apply min/max checks
    if (min_val != null && sr < min_val) return false;
    if (max_val != null && max_val != MAX_STAR_RATING_VALUE && sr > max_val) return false;

    return true;
};

export const get_missing_beatmaps = (beatmaps) => {
    const missing_beatmaps = [];

    if (!beatmaps) {
        return missing_beatmaps;
    }

    for (let i = 0; i < beatmaps.length; i++) {
        const md5 = beatmaps[i];
        const beatmap = beatmap_manager.get_beatmap_by_md5(md5) || {};

        // if you download something from osu!Collector, the function will add basic metadata to reader object such as: title, artist, etc...
        // so we need to make sure this variable is false
        if (beatmap?.downloaded) {
            continue;
        }

        missing_beatmaps.push({ md5 });
    }

    return missing_beatmaps;
};

export const filter_beatmaps = (list, query, extra = { unique: false, invalid: false, sort: null, sr: null, status: null }) => {
    if (!beatmap_manager.has_beatmaps() || !list) {
        return [];
    }

    const beatmaps = list ? list : Array.from(beatmap_manager.beatmaps.keys());
    const seen_unique_ids = new Set();

    if (!beatmaps) {
        console.log("failed to get beatmaps array");
        return [];
    }

    let filtered_beatmaps = [];

    // filter beatmaps based on query and stuff
    for (let i = 0; i < beatmaps.length; i++) {
        const list_beatmap = beatmaps[i];
        const { beatmap, filtered } = get_beatmap_data(list_beatmap, query ?? "", false);

        if (filtered) {
            continue;
        }

        // extra.invalid == i dont give a fuck if the map is invalid bro, just gimme ts
        if (!extra.invalid && !beatmap.hasOwnProperty("downloaded")) {
            continue;
        }

        // filter by status
        if (extra.status) {
            // oh yeah, more hacks
            if (!config.lazer_mode && (extra.status == "graveyard" || extra.status == "wip")) {
                extra.status = "pending";
            }

            if (beatmap.status_text != extra.status) continue;
        }

        // check if we already added this unique id
        if (extra.unique && beatmap?.unique_id && seen_unique_ids.has(beatmap?.unique_id)) {
            continue;
        }

        // filter by sr
        if (beatmap && extra.sr) {
            const result = filter_by_sr(beatmap, extra.sr.min, extra.sr.max);

            if (!result) {
                continue;
            }
        }

        filtered_beatmaps.push(beatmap);

        if (extra.unique && beatmap?.unique_id) {
            seen_unique_ids.add(beatmap.unique_id);
        }
    }

    // sort pass
    if (extra.sort != null) {
        filtered_beatmaps = sort_beatmaps(filtered_beatmaps, extra.sort);
    }

    // return only hashes
    return filtered_beatmaps.map((b) => (typeof b == "string" ? b : b?.md5));
};

export const add_beatmap = (hash, beatmap) => {
    return beatmap_manager.add_beatmap(hash, beatmap);
};

export const get_beatmaps_from_database = async (force) => {
    if (force) {
        beatmap_manager.clear();
    }

    if (beatmap_manager.beatmaps && beatmap_manager.beatmaps.size > 0) {
        return true;
    }

    const osu_folder = config.lazer_mode ? config.lazer_path : config.stable_path;

    if (!osu_folder) {
        console.error("[get beatmaps] failed to get osu! folder");
        return false;
    }

    const file_path = config.lazer_mode ? path.resolve(osu_folder, "client.realm") : path.resolve(osu_folder, "osu!.db");

    if (!fs.existsSync(file_path)) {
        console.error("[get beatmaps] failed to get osu.db file in", file_path);
        return false;
    }

    const result = await reader.get_osu_data(file_path);

    if (result == null) {
        console.error("[get beatmaps] failed to read osu file");
        return false;
    }

    // initialize beatmap manager with raw data
    beatmap_manager.initialize(result);

    // process beatmaps with indexer for additional data
    const processed_beatmaps = await process_beatmaps(result.beatmaps);

    // ensure we have a valid map
    if (!processed_beatmaps) {
        console.error("[get beatmaps] failed to process beatmaps");
        return false;
    }

    // update beatmap manager with processed data
    beatmap_manager.process_beatmaps(processed_beatmaps);

    return true;
};

export const get_beatmapset_by_id = (beatmapset_id) => {
    return beatmap_manager.get_beatmapset_by_id(beatmapset_id);
};

export const get_beatmaps_from_beatmapset = (beatmapset_id) => {
    return beatmap_manager.get_beatmaps_from_set(beatmapset_id);
};

export const get_all_beatmapsets = () => {
    return beatmap_manager.get_all_beatmapsets();
};

export const filter_beatmapsets = (criteria = {}) => {
    return beatmap_manager.filter_beatmapsets(criteria);
};

export const get_beatmap_manager_stats = () => {
    return beatmap_manager.get_stats();
};
