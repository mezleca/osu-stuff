import { get_app_path } from "./utils.js";
import { config } from "./config.js";

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let database = null;
export let insert_mirror = null;
export let delete_mirror = null;
export let get_mirrors = null;

const APP_PATH = get_app_path();

const create_mirror_table = () => {
	database.exec(`
		CREATE TABLE IF NOT EXISTS mirrors(
			name TEXT PRIMARY KEY,
			url TEXT
		);
	`);
};

export const initialize_mirrors = () => {
	const database_path = path.resolve(APP_PATH, "mirrors.db");

	if (!fs.existsSync(database_path)) {
		fs.writeFileSync(database_path, "");
	}

	database = new Database(database_path);
	create_mirror_table();

	get_mirrors = database.prepare("SELECT * FROM mirrors");
	insert_mirror = database.prepare(`
		INSERT OR REPLACE INTO mirrors
		(name, url)
		VALUES(?, ?)
	`);
	delete_mirror = database.prepare(`
		DELETE FROM mirrors WHERE name = ?	
	`);

	// get mirrors if thjeres any
	update_mirrors();
};

export const update_mirrors = () => {
	const mirrors = get_mirrors.all();
	if (mirrors) {
		config.mirrors = mirrors;
	}
	console.log(config.mirrors);
};
