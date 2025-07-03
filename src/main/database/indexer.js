import { parseFile } from "music-metadata";
import { parallel_map } from "../beatmaps/downloader.js";
import { get_app_path } from "./utils.js";

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const PROCESSOR_PATH = get_app_path();

console.log("processor path", PROCESSOR_PATH);

let database = null;
let add_beatmap = null;
let get_beatmap = null;
let get_beatmaps = null;
let insert_beatmaps = null;

const create_extra_table = () => {
	database.exec(`
		CREATE TABLE IF NOT EXISTS extra (
			md5 TEXT PRIMARY KEY,
			background TEXT,
			duration INTEGER,
			last_modified INTEGER
		);
	`);
};

export const initialize_indexer = () => {

	// initialize database
	const file_path = path.resolve(PROCESSOR_PATH, "processor.db");

	if (!fs.existsSync(file_path)) {
		fs.writeFileSync(file_path, "");
	}

	database = new Database(file_path);
	create_extra_table();

	// initialize statements
	add_beatmap = database.prepare(`
		INSERT or REPLACE INTO extra
		(md5, background, duration, last_modified)
		VALUES (?, ?, ?, ?)
	`);

	get_beatmap = database.prepare(`
		SELECT 1 FROM extra WHERE md5 = ?
	`);

	get_beatmaps = database.prepare(`
		SELECT * FROM extra
	`);

	insert_beatmaps = database.transaction((beatmaps) => {
		for (const beatmap of beatmaps) {
			add_beatmap.run(beatmap.md5, beatmap.background, beatmap.duration, beatmap.last_modified);
		}
	});
};

export const get_data = (md5) => {
	return get_beatmap(md5);
};

const get_audio_duration = async (location) => {
	try { 
		const result = await parseFile(location);
		return result.format.duration;
	} catch(err) {
		console.log(err);
		return null;
	}
};

// @TODO: everything
const get_beatmap_image = (b) => {
	return b.image_location;
};

// @TODO: test lol
export const process = async (b) => {

	// make sure we have a beatmap folder
	if (!b.audio_folder) {
		return;
	}

	const duration = await get_audio_duration(b.audio_folder);

	Object.assign(b, {
		duration: duration
	});

	return b;
};

// get extra information like: song duration, background location, etc...
// @TODO: not even sure that this parallel function works
export const process_beatmaps = async (beatmaps) => {
	
	const saved = new Set(get_beatmaps.all().map((b) => [b.md5, b]));
	const missing = [];

	await parallel_map(beatmaps, async (b) => {

		const uhh = saved.get(b.md5); 

		if (uhh) return;
		if (uhh.last_modified > b.last_modified) return;

		const result = await process(b);
		missing.push(result);
	}, 10);

	console.log(result);

	// process the rest of the beatmaps
	//insert_beatmaps(missing);
};