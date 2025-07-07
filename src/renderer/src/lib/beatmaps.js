import { collections, osu_beatmaps, show_notification } from "../store";

export const get_beatmap_data = async (md5) => {
	const cached = osu_beatmaps.get(md5);

	if (cached) {
		return cached;
	}

	const beatmap = await window.osu.get_beatmap(md5);

	if (!beatmap) {
		return {};
	}

	osu_beatmaps.add(md5, beatmap.result);
	return beatmap.result;
};

export const get_filtered_beatmaps = async (name, query, unique) => {
	const beatmaps = name ? collections.get(name).maps : null;

	if (name && !beatmaps) {
		show_notification({ type: "error", text: "failed to get beatmaps" });
		return;
	}

	const result = await window.osu.filter_beatmaps(beatmaps, query, unique);

	if (!result) {
		show_notification({ type: "error", text: "failed to filter beatmaps" });
		console.log(result);
		return;
	}

	return result;
};
