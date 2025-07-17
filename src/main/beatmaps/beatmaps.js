import { config } from "../database/config";
import { process_beatmaps } from "../database/indexer";
import { reader } from "../reader/reader";

import fs from "fs";
import path from "path";

export const GAMEMODES = ["osu!", "taiko", "ctb", "mania"];

let osu_data = null;

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

export const get_beatmap_by_md5 = (md5) => {
	return osu_data.beatmaps.get(md5);
};

// @NOTE: a "little" too expensive
export const get_beatmaps_by_id = (id) => {
	const beatmaps = [];
	for (const [_, beatmap] of osu_data.beatmaps) {
		if (beatmap.unique_id == id) {
			beatmaps.push(beatmap);
		}
	}
	return beatmaps;
};

export const get_beatmap_data = (id, query, is_unique_id) => {
	const result = { filtered: false, beatmap: null };

	// ignore unknown maps if we dont have a query yet
	if (!id || id == "") {
		result.filtered = true;
		return result;
	}

	result.beatmap = is_unique_id ? get_beatmaps_by_id(id) : get_beatmap_by_md5(id);

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

const TEXT_SORT_KEYS = ["title", "artist"];
const NUMBER_SORT_KEYS = ["duration", "length", "ar", "cs", "od", "hp"];

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
			return a_val.localeCompare(b_val);
		} else {
			const a_val = a[type] || 0;
			const b_val = b[type] || 0;
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

	// my logic sucks so lets do that
	if (min == 0 && max == 0) {
		return true;
	}

	const star_rating = beatmap.star_rating[beatmap.mode]?.nm;

	if (star_rating && star_rating >= min && star_rating <= max) {
		return true;
	}

	return false;
};

export const get_missing_beatmaps = (beatmaps) => {
	const missing_beatmaps = [];
	
	if (!beatmaps) {
		console.log("missing the fucking beatmap list");
		return missing_beatmaps;
	}

	for (let i = 0; i < beatmaps.length; i++) {
		const md5 = beatmaps[i];
		const beatmap = osu_data.beatmaps.get(md5) || { };

        // if you download something from osu!Collector, the function will add basic metadata to reader object such as: title, artist, etc...
        // so we need to make sure this variable is false
        if (beatmap?.downloaded) {
            continue;
        }

		missing_beatmaps.push(md5);
	}

	return missing_beatmaps;
};

export const filter_beatmaps = (list, query, extra = { unique: false, sort: null, sr: null, status: null }) => {
	console.log("filtered options", extra);

	if (!osu_data) {
		console.log("osu_data is null");
		return [];
	}

	const beatmaps = list ? list : Array.from(osu_data.beatmaps.keys());
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

		// ignore invalid beatmaps
		if (!beatmap?.downloaded) {
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

export const get_extra_information = async (beatmaps) => {
	const beatmaps_array = Array.from(beatmaps.values());
	const processed_data = await process_beatmaps(beatmaps_array);

	if (processed_data) {
		for (const [md5, extra_info] of processed_data) {
			const existing_beatmap = beatmaps.get(md5);
			if (existing_beatmap) {
				beatmaps.set(md5, { ...existing_beatmap, ...extra_info });
			}
		}
	}

	return beatmaps;
};

export const get_beatmaps_from_database = async (force) => {
	if (force) {
		osu_data = null;
	}

	if (osu_data) {
		console.log("nuh uh", force);
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

	osu_data = result;
	osu_data.beatmaps = await get_extra_information(osu_data.beatmaps);

	return true;
};
