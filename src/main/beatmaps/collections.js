import { config } from "../database/config.js";
import { reader } from "../reader/reader.js";

import path from "path";
import fs from "fs";

export const get_collections_from_database = async () => {

	const location = config.lazer_mode ? 
		path.resolve(config.lazer_path, "client.realm") :
		path.resolve(config.stable_path, "collection.db");

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