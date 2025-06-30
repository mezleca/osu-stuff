import { collections, osu_beatmaps, show_notification } from "../store";

export const gamemodes = {
	"osu!": 0,
	taiko: 1,
	ctb: 2,
	mania: 3
};

export const get_beatmap_sr = (beatmap, gamemode = 0) => {
	try {
		const star_rating = beatmap?.star_rating;

		if (!star_rating || star_rating?.length == 0) {
			return Number(0).toFixed(2);
		}

		// get nm star rating based on gamemode
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

// @TODO: better naming
const renamed_list = new Map([["star", "star_rating"]]);

const get_key = (key) => {
	if (renamed_list.has(key)) {
		return renamed_list.get(key);
	}
	return key;
};

const validate_filter = (key, op, value) => {
	if (!key == null) {
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

export const search_filter = (beatmap, query, search_filters) => {
	let valid = true;

	// filter by basic keywords
	const artist = beatmap?.artist || "unknown";
	const title = beatmap?.title || "unknown";
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

export const get_beatmap_data = (data, query) => {
	let md5 = "";
	let beatmap = null;

	if (typeof data == "object") {
		md5 = data.md5;
		beatmap = data;
	} else {
		md5 = data;
	}

	// check if the md5 is present
	if (!md5 || md5 == "") {
		return { filtered: false, result: null };
	}

	// get beatmap using the hash
	if (!beatmap) {
		beatmap = osu_beatmaps.get(md5);
	}

	// ignore unknown maps if we dont have a query yet
	if (!beatmap && query == "") {
		return { filtered: true, result: { md5 } };
	}

	if (query && query != "") {
		const passes_filter = filter_beatmap(beatmap, query);
		return { filtered: passes_filter, result: beatmap };
	}

	return { filtered: true, result: beatmap };
};

export const get_filtered_beatmaps = (name, query, unique) => {
	let filtered = [];
	let beatmaps = name ? collections.get(name).maps : osu_beatmaps.all();

	if (!beatmaps) {
		show_notification({ type: "error", text: "failed to get current collection beatmaps..." });
		if (name) console.log("current collection:", collections.get(name));
		return;
	}

	// @TOFIX:
	// unique will return only 1 diff per set
	// so sets like (jump pack) where theres different songs per diff will be removed
	if (!name && beatmaps.length > 0 && unique) {
		let ids = new Set();
		beatmaps = beatmaps.filter((b) => {
			const result = !ids.has(b.beatmapset_id);
			ids.add(b.beatmapset_id);
			return result;
		});
	}

	// loop through each md5 of our collection
	for (let i = 0; i < beatmaps.length; i++) {
		const hash = beatmaps[i];
		const data = get_beatmap_data(hash, query ?? "");
		if (data.filtered) {
			filtered.push(data.result);
		}
	}

	// return filtered list
	return filtered;
};
