import { collections } from "../store/collections";

export const get_collections = async (force) => {
	// update collection store
	const collection_data = await window.osu.get_collections();

	if (!collection_data) {
		return;
	}

	collections.set(Array.from(collection_data.collections.values()));

	const beatmaps_data = await window.osu.get_beatmaps(force);

	if (!beatmaps_data) {
		console.log("failed to initialize");
		return;
	}
};
