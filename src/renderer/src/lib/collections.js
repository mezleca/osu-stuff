import { collections, config } from "../store";
import { reader } from "./reader/reader";
import { osu_beatmaps } from "../store";
import { sleep } from "./utils";

// update current collection object
export const get_collections = async () => {
	const lazer_mode = config.get("lazer_mode");
	const files = await window.fs.get_osu_files();

	// check if we received the files
	if (!lazer_mode && files?.error) {
		console.error(files?.error);
		return;
	}

	// update collection store
	const collection_data = await reader.get_collections_data(null ? files.cl : files.cl);
	collections.set(Array.from(collection_data.collections.values()));

	console.log(collections.get("mzle"));

	// let collections load on collections tab
	await sleep(5);

	const osu_data = await reader.get_osu_data(lazer_mode ? null : files.db);
	osu_beatmaps.update(() => osu_data.beatmaps);
};
