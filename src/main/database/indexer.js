import { get_app_path } from "./utils.js";
import { reader } from "../reader/reader.js";
import { BrowserWindow } from "electron";
import { sleep } from "../beatmaps/downloader.js";

import Processor from "../../../build/Release/processor.node";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { filter_beatmaps } from "../beatmaps/beatmaps.js";

const PROCESSOR_PATH = get_app_path();

console.log("processor path", PROCESSOR_PATH);

export let is_processing = false;

/** @type {BrowserWindow}*/
let window = null;
let database = null;

// database stuff
let add_beatmap = null;
let get_beatmap = null;
let get_beatmaps = null;
let insert_beatmaps = null;
let check_beatmaps = null;

const create_extra_table = () => {
	database.exec(`
		CREATE TABLE IF NOT EXISTS extra (
			unique_id TEXT PRIMARY KEY,
			audio_path TEXT,
			image_path TEXT,
			duration INTEGER,
			last_modified INTEGER
		);
	`);
};

/** @param {BrowserWindow} mainWindow */
export const initialize_indexer = async (mainWindow) => {
	// initialize database
	const file_path = path.resolve(PROCESSOR_PATH, "indexer.db");

	if (!fs.existsSync(file_path)) {
		fs.writeFileSync(file_path, "");
	}

	database = new Database(file_path);
	create_extra_table();

	// initialize statements
	add_beatmap = database.prepare(`
		INSERT or REPLACE INTO extra
		(unique_id, audio_path, image_path, duration, last_modified)
		VALUES (?, ?, ?, ?, ?)
	`);

	get_beatmap = database.prepare(`
		SELECT 1 FROM extra WHERE unique_id = ?
	`);

	get_beatmaps = database.prepare(`
		SELECT * FROM extra
	`);

	insert_beatmaps = database.transaction((beatmaps) => {
		for (const beatmap of beatmaps) {
			add_beatmap.run(beatmap.unique_id, beatmap.background, beatmap.duration, beatmap.last_modified);
		}
	});

	check_beatmaps = database.transaction((beatmaps) => {
		const saved_beatmaps = new Map();
		const BATCH_SIZE = 999;

		for (let i = 0; i < beatmaps.length; i += BATCH_SIZE) {
			const values = beatmaps.slice(i, i + BATCH_SIZE).map((b) => b.unique_id);
			const placeholder = new Array(values.length).fill("?").join(",");

			const query = database.prepare(`
				SELECT unique_id, last_modified from extra
				WHERE unique_id IN (${placeholder})	
			`);

			const result = query.all(...values);

			for (let j = 0; j < result.length; j++) {
				saved_beatmaps.set(result[j].unique_id, result[j].last_modified);
			}
		}

		// only return beatmaps that are not saved or have a different last_modified
		return beatmaps.filter((b) => {
			const saved_last_modified = saved_beatmaps.get(b.unique_id);
			return saved_last_modified === undefined || saved_last_modified !== b.last_modified;
		});
	});

	window = mainWindow;
};

export const check_saved_beatmaps = (beatmaps) => {
	return check_beatmaps(beatmaps);
};

export const get_data = (md5) => {
	return get_beatmap(md5);
};

// get extra information like: song duration, background location, etc...
// @TODO: not even sure that this parallel function works
// @TODO: show on frontend that we are processing something
export const process_beatmaps = async (list) => {

	// uhh
    if (is_processing) {
        console.error("[indexer] already processing");
        return;
    }

    is_processing = true;
    let beatmaps = check_beatmaps(list);

    if (beatmaps.length == 0) {
        is_processing = false;
        return;
    }

    window.webContents.send("process", { show: true });

    const first_pass = filter_beatmaps(beatmaps, "", true).map((b) => ({
        id: b.unique_id,
        file_path: reader.get_file_location(b),
        last_modified: b.last_modified
    }));

	const processed_result = await Processor.process_beatmaps(first_pass, (i) => {
		window.webContents.send("process-update", { 
			status: "processing beatmaps",
			index: i,
			length: first_pass.length,
			small: "this might take a while" // @TODO: persist process values on frontend so i dont have to send everything every time
		});
	});

	fs.writeFileSync("./result.json", JSON.stringify(processed_result));

    window.webContents.send("process", { show: false });
    is_processing = false;
};
