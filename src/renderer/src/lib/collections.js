import { collections } from "../store";

export const get_collections = async () => {
	// update collection store
	const collection_data = await window.osu.get_collections();

	if (!collection_data) {
		console.log("uhh", collection_data);
		return;
	}

	collections.set(Array.from(collection_data.collections.values()));

	const beatmaps_data = await window.osu.get_beatmaps();

	if (!beatmaps_data) {
		console.log("failed to initialize");
		return;
	}
};
