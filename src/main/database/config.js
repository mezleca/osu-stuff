import { get_app_path, get_osu_path } from "./utils.js";

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export const CONFIG_LOCATION = get_app_path();
const config_keys = [
	"osu_id",
	"osu_secret",
	"stable_path",
	"stable_songs_path",
	"lazer_path",
	"export_path",
	"local_images",
	"lazer_mode",
	"radio_volume"
];

let database = null;
let get_config = null;

export let config = {
	osu_id: null,
	osu_secret: null,
	stable_path: null,
	stable_songs_path: null,
	lazer_path: null,
	export_path: null,
	local_images: false,
	lazer_mode: false,
	radio_volume: null,
	mirrors: []
};

console.log("config path", CONFIG_LOCATION);

const create_config_table = () => {
	database.exec(`
		CREATE TABLE IF NOT EXISTS config (
			id INTEGER PRIMARY KEY DEFAULT 1,
			osu_id INTEGER,
			osu_secret TEXT,
			stable_path TEXT,
			stable_songs_path TEXT,
			lazer_path TEXT,
			export_path TEXT,
			local_images INTEGER,
			lazer_mode INTEGER,
			radio_volume INTEGER
		);
	`);
};

const update_config = (values) => {
	const keys = Object.keys(values).filter((k) => config_keys.includes(k));

	if (keys.length == 0) {
		console.log("cant update cuz 0 length");
		return;
	}

	const clause = keys.map((k) => `${k} = EXCLUDED.${k}`).join(", ");
	const statement = database.prepare(`
		INSERT INTO config (id, ${keys.join(", ")}) 
		VALUES (1, ${keys.map(() => "?").join(", ")})
		ON CONFLICT(id) DO UPDATE SET ${clause}
	`);

	const params = keys.map((k) => {
		const value = typeof values[k] == "boolean" ? Number(values[k]) : values[k];
		config[k] = values[k];
		return value;
	});

	statement.run(...params);
};

export const initialize_config = async () => {
	const file_path = path.resolve(CONFIG_LOCATION, "config.db");

	database = new Database(file_path);
	create_config_table();

	// Ensure at least one row exists in the config table
	const rowCount = database.prepare("SELECT COUNT(*) as count FROM config").get().count;

	if (rowCount == 0) {
		database.prepare("INSERT INTO config (id) VALUES (1)").run();
	}

	get_config = database.prepare(`SELECT * FROM config WHERE id = 1`);
	let config_obj = get_config.get();

	if (!config_obj) {
		return;
	}

	// update config_obj values on start
	for (const [k, v] of Object.entries(config_obj)) {
		if (k == "local_images" || k == "lazer_mode") {
			config[k] = Boolean(v);
			continue;
		}
		config[k] = v;
	}

	if (config_obj.stable_path != undefined && config_obj.stable_path != "") {
		return;
	}

	// populate config with the default value (if possible)
	const osu_path_result = await get_osu_path();

	const osu_path = osu_path_result?.stable_path;
	const lazer_path = osu_path_result?.lazer_path;

	if (osu_path != "") {
		update_config({ stable_path: osu_path, lazer_mode: config.lazer_mode ?? false });

		const stable_songs_path = path.resolve(osu_path, "Songs");

		// maybe the user have a different songs path?
		if (fs.existsSync(stable_songs_path)) {
			update_config({ stable_songs_path });
		}
	}

	if (lazer_path) {
		update_config({ lazer_path, lazer_mode: config.lazer_mode ?? false });
	}
};

export const update_config_database = (obj) => {
	return update_config(obj);
};

export const get_config_database = () => {
	return config;
};
