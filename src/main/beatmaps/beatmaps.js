import { config } from "../database/config";
import { process_beatmaps } from "../database/indexer";
import { reader } from "../reader/reader";
import { get_colection_beatmaps } from "./collections";

import fs from "fs";
import path from "path";

export const GAMEMODES = ["osu!", "taiko", "ctb", "mania"];
export const MAX_STAR_RATING_VALUE = 10; // lazer
export const MAX_RETURN_SIZE = 256;

// @TODO: create check funcs for ALL_BEATMAPS and ALL_STATUS on main proc (so renderer dont have to redeclarated them)
export const ALL_BEATMAPS_KEY = "@stuff:__all_beatmaps__";
export const ALL_STATUS_KEY = "@stuff:__all_status__";

// filter
const TEXT_SORT_KEYS = ["title", "artist"];
const NUMBER_SORT_KEYS = ["duration", "length", "ar", "cs", "od", "hp"];

let osu_data = null;

// cache for beatmap lists ( list_id | { state, list } )
const beatmaps_cache = new Map();

const create_state_key = (options) => {
    return JSON.stringify({ ...options, list_id: options.id ?? "" });
};

export const clear_beatmap_list_cache = (list_id) => {
    if (list_id && beatmaps_cache.has(list_id)) {
        beatmaps_cache.delete(list_id);
    }
};

const create_beatmaps_result = (value, data) => {
    const result = { count: value || 0, data: [], found: true };

    if (osu_data && !value) result.count = osu_data.beatmaps.size;
    if (data) result.data = data;

    return result;
};

export const update_beatmap_list = (options) => {
    const list_id = options.id;

    if (!list_id) {
        return { found: false };
    }

    const new_state = create_state_key(options);
    const list = beatmaps_cache.get(list_id) ?? { state: new_state, count: 0, maps: [] };

    // dont update if state matches
    if (new_state == list.state && beatmaps_cache.has(list_id)) {
        console.log("detected same state, returning old list");
        return create_beatmaps_result(list.count);
    }

    // always clear
    if (beatmaps_cache.has(list_id)) {
        clear_beatmap_list_cache(list_id);
    }

    // update the state / filtered list
    list.maps = filter_beatmaps(options) || [];
    list.count = list.maps.length;
    list.state = new_state;

    // update cache
    beatmaps_cache.set(list_id, list);

    // return basic data
    return create_beatmaps_result(list.count);
};

// get beatmaps using paging system
const get_beatmap_from_list = (id, index) => {
    if (!id) {
        return false;
    }

    // get list by id
    const current_list = beatmaps_cache.get(id);

    if (!current_list) {
        console.log("failed to get list data from:", id);
        return false;
    }

    if (current_list.count == 0) {
        return false;
    }

    const hash = current_list.maps[index];
    return osu_data.beatmaps.get(hash) ?? false;
};

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
export const get_common_bpm = (beatmap) => {
    if (!beatmap?.timing_points || beatmap?.timing_points.length == 0) {
        return 0;
    }

    const beat_length_map = new Map();

    const timing_points = beatmap.timing_points;
    const last_time = beatmap.length > 0 ? beatmap.length : timing_points[timing_points.length - 1].offset;

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

        // hack
        // also need global gamemode variable
        if (key == "star_rating") {
            if (!validate_filter(beatmap?.[key][0]?.nm, filter.o, thing)) {
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
    return osu_data.player_name;
};

export const get_beatmap_by_md5 = (md5) => {
    return osu_data.beatmaps.get(md5);
};

export const get_beatmaps_by_id = (id) => {
    const beatmaps = [];
    for (const [_, beatmap] of osu_data.beatmaps) {
        if (beatmap.unique_id == id) {
            beatmaps.push(beatmap);
        }
    }
    return beatmaps;
};

export const get_beatmap_by_set_id = (id) => {
    for (const [_, beatmap] of osu_data.beatmaps) {
        if (beatmap.beatmapset_id == id) {
            return beatmap;
        }
    }
    return false;
};

export const get_beatmap_data = (options = { id: null, index: null, is_unique: false }) => {
    const result = { filtered: false, beatmap: null };

    // ignore unknown maps if we dont have a query yet
    if (!options.id || options.id == "") {
        result.filtered = true;
        return result;
    }

    // handle beatmap from beatmap list
    if (options.id != null && options.index != null) {
        result.beatmap = get_beatmap_from_list(options.id, options.index);
        if (!result.beatmap) result.filtered = true;
        return result;
    }

    result.beatmap = options.is_unique ? get_beatmaps_by_id(options.id) : get_beatmap_by_md5(options.id);

    // ignore unknown maps if we dont have a query yet
    if (!result.beatmap) {
        result.beatmap = { [options.is_unique ? "id" : "md5"]: options.id };
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
    // mhm
    if (!TEXT_SORT_KEYS.includes(type) && !NUMBER_SORT_KEYS.includes(type)) {
        return beatmaps;
    }

    const result = beatmaps.sort((a, b) => {
        if (TEXT_SORT_KEYS.includes(type)) {
            const a_val = normalize_text(a[type]);
            const b_val = normalize_text(b[type]);

            // push empty/invalid values to the end
            if (!a_val && b_val) return 1;
            if (a_val && !b_val) return -1;
            if (!a_val && !b_val) return 0;

            return a_val.localeCompare(b_val);
        } else {
            const a_val = a[type] || 0;
            const b_val = b[type] || 0;

            // push null/undefined values to the end
            if ((a_val == null || a_val == undefined) && b_val != null && b_val != undefined) return 1;
            if (a_val != null && a_val != undefined && (b_val == null || b_val == undefined)) return -1;
            if ((a_val == null || a_val == undefined) && (b_val == null || b_val == undefined)) return 0;

            return b_val - a_val;
        }
    });

    return result;
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
        const beatmap = osu_data.beatmaps.get(md5) || {};

        // if you download something from osu!Collector, the function will add basic metadata to reader object such as: title, artist, etc...
        // so we need to make sure this variable is false
        if (beatmap?.downloaded) {
            continue;
        }

        missing_beatmaps.push({ md5 });
    }

    return missing_beatmaps;
};

export const filter_beatmaps = (options = { id: "", query: "", unique: false, invalid: false, sort: null, sr: null, status: null }) => {
    if (!osu_data) {
        console.log("osu data is null LUL");
        return [];
    }

    const beatmaps = options.id == ALL_BEATMAPS_KEY ? Array.from(osu_data.beatmaps.keys()) : get_colection_beatmaps(options.id);

    if (!beatmaps) {
        return [];
    }

    const seen_unique_ids = new Set();
    let filtered_beatmaps = [];

    // filter beatmaps based on query and stuff
    for (let i = 0; i < beatmaps.length; i++) {
        const list_beatmap = beatmaps[i];
        const { beatmap, filtered } = get_beatmap_data({ id: list_beatmap, is_unique: false });

        if (filtered) {
            continue;
        }

        // options.invalid == i dont give a fuck if the map is invalid bro, just gimme ts
        if (!options.invalid && !beatmap.hasOwnProperty("downloaded")) {
            continue;
        }

        // filter by status
        if (options.status) {
            // oh yeah, more hacks
            if (!config.lazer_mode && (options.status == "graveyard" || options.status == "wip")) {
                options.status = "pending";
            }

            if (beatmap.status_text != options.status) continue;
        }

        // check if we already added this unique id
        if (options.unique && beatmap?.unique_id && seen_unique_ids.has(beatmap?.unique_id)) {
            continue;
        }

        // filter by sr
        if (beatmap && options.sr) {
            const result = filter_by_sr(beatmap, options.sr.min, options.sr.max);

            if (!result) {
                continue;
            }
        }

        filtered_beatmaps.push(beatmap);

        if (options.unique && beatmap?.unique_id) {
            seen_unique_ids.add(beatmap.unique_id);
        }
    }

    // sort pass
    if (options.sort != null) {
        filtered_beatmaps = sort_beatmaps(filtered_beatmaps, options.sort);
    }

    // return only hashes
    return filtered_beatmaps.map((b) => (typeof b == "string" ? b : b?.md5));
};

export const add_beatmap = (hash, beatmap) => {
    if (!hash || !beatmap) {
        console.log("failed to add beatmap (missing shit)");
        return false;
    }

    osu_data.beatmaps.set(hash, beatmap);
    return create_beatmaps_result();
};

export const load_beatmaps_from_database = async (force) => {
    // reset osu object on force
    if (force) {
        osu_data = null;
    }

    // return current data if we already loaded
    if (osu_data) {
        return create_beatmaps_result();
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

    // read data from binary file
    const result = await reader.get_osu_data(file_path);

    if (result == null) {
        console.error("[get beatmaps] failed to read osu file");
        return false;
    }

    // update and process beatmaps (give extra information like actual song duration, audio_path, etc...)
    osu_data = result;
    osu_data.beatmaps = await process_beatmaps(osu_data.beatmaps);

    return create_beatmaps_result();
};
