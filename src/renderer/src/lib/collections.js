import { collections, config } from "../store";
import { sleep } from "./utils";

export const get_collections = async () => {
	// update collection store
	const collection_data = await window.osu.get_collections();

	if (!collection_data) {
		console.log("uhh", collection_data);
		return;
	}

	console.log(collection_data);
	collections.set(Array.from(collection_data.collections.values()));

	// get beatmap
	console.time("osu");
	const beatmaps_data = await window.osu.get_beatmaps();
	console.timeEnd("osu");

	if (!beatmaps_data) {
		console.log("failed to initialize");
		return;
	}
};
