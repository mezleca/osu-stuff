import { config } from "../database/config.js";
import { reader } from "../reader/reader.js";

import path from "path";
import fs from "fs";

export const get_collections_from_database = async () => {
	
	const osu_folder = config.lazer_mode ? config.lazer_path : config.stable_path;

	if (!osu_folder) {
		console.error("[get_collections] failed to get osu! folder");
		return;
	}

	console.log(osu_folder);

	const location = config.lazer_mode ? path.resolve(osu_folder, "client.realm") : path.resolve(osu_folder, "collection.db");

	console.log(location);

	if (!fs.existsSync(location)) {
		console.log("failed to get collection file in", location);
		return;
	}

	const result = await reader.get_collections_data(location);

	if (result == null) {
		console.log("failed to get collection file");
		return;
	}

	return result;
};

export const update_collections = (collections) => {
	return true;
};