import { collections } from "../store/collections";
import { osu_beatmaps } from "../store/beatmaps";
import { show_notification } from "../store/notifications";

const get_beatmap = async (id, is_unique_id) => {
	const cached = osu_beatmaps.get(id);

	if (cached) {
		return cached;
	}

	const result = await window.osu.get_beatmap(id, is_unique_id);

	if (!result) {
		return {};
	}

	osu_beatmaps.add(id, result.beatmap);
	return result.beatmap;
};

export const get_beatmap_data = async (md5) => {
	return await get_beatmap(md5, false);
};

export const get_by_unique_id = async (id) => {
	return await get_beatmap(id, true);
};

export const get_filtered_beatmaps = async (name, query, extra) => {
	const beatmaps = name ? collections.get(name).maps : null;

	if (name && !beatmaps) {
		show_notification({ type: "error", text: "failed to get beatmaps" });
		return;
	}

	const result = await window.osu.filter_beatmaps(beatmaps, query, extra);

	if (!result) {
		show_notification({ type: "error", text: "failed to filter beatmaps" });
		console.log(result);
		return;
	}

	return result;
};
