import { get_app_path } from "./utils.js";
import { reader } from "../reader/reader.js";
import { BrowserWindow } from "electron";
import { config } from "./config.js";

import Processor from "../../../build/Release/processor.node";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const PROCESSOR_PATH = get_app_path();
const BATCH_SIZE = 999;

/** @type {BrowserWindow} */
let window = null;
let database = null;

let add_beatmaps = null;
let insert_beatmaps = null;

const create_extra_table = () => {
    database.exec(`
        CREATE TABLE IF NOT EXISTS extra (
            md5 TEXT PRIMARY KEY,
            unique_id TEXT,
            audio_path TEXT,
            image_path TEXT,
            duration INTEGER
        );
    `);
};

export const initialize_indexer = async (mainWindow) => {
    const file_path = path.resolve(PROCESSOR_PATH, "indexer.db");

    if (!fs.existsSync(file_path)) {
        fs.writeFileSync(file_path, "");
    }

    database = new Database(file_path);
    create_extra_table();

    add_beatmaps = database.prepare(`
        INSERT OR REPLACE INTO extra
        (md5, unique_id, audio_path, image_path, duration)
        VALUES (?, ?, ?, ?, ?)
    `);

    insert_beatmaps = database.transaction((beatmaps) => {
        for (const beatmap of beatmaps) {
            add_beatmaps.run(beatmap.md5, beatmap.unique_id, beatmap.audio_path, beatmap.image_path, beatmap.duration);
        }
    });

    window = mainWindow;
};

// unique_id = song id btw
// yeah, i cant name stuff
export const filter_unique_beatmaps = (beatmaps_array) => {
    const seen_unique_ids = new Set();
    const unique_beatmaps = [];

    for (let i = 0; i < beatmaps_array.length; i++) {
        const beatmap = beatmaps_array[i];

        // idk if this is normal on stable but my db has like 500/30000 beatmaps without any trace of audio file lol
        if (!beatmap.unique_id) {
            continue;
        }

        // check if we already added this unique id
        if (!seen_unique_ids.has(beatmap.unique_id)) {
            seen_unique_ids.add(beatmap.unique_id);
            unique_beatmaps.push(beatmap);
        }
    }

    return unique_beatmaps;
};

export const process_beatmaps = async (beatmaps_array) => {
    if (Processor.is_processing) {
        console.error("[indexer] already processing");
        return null;
    }

    if (!beatmaps_array || beatmaps_array.length == 0) {
        return new Map();
    }

    window?.webContents.send("process", { show: true });

    const md5_list = beatmaps_array.map((b) => b.md5);
    const existing_info = get_multiple_data(md5_list);

    // get non saved beatmaps
    const to_process = beatmaps_array.filter((b) => !existing_info.has(b.md5));

    let processed_beatmaps = [];

    if (to_process.length > 0) {
        console.log(`[indexer] processing ${to_process.length} new beatmaps`);

        const processor_input = [];

        for (let i = 0; i < to_process.length; i++) {
            const beatmap = to_process[i];
            const result = {};

            result.md5 = beatmap.md5;
            result.unique_id = beatmap.unique_id;

            if (config.lazer_mode) {
                result.file_path = beatmap.file_path;
                result.audio_path = beatmap.audio_path;
                result.image_path = beatmap.image_path;
            } else {
                result.file_path = reader.get_file_location(beatmap);
            }

            processor_input.push(result);
        }

        processed_beatmaps = await Processor.process_beatmaps(processor_input, (index) => {
            const file_name = processor_input[index].file_path;
            const split = file_name.split("/");
            window?.webContents.send("process-update", {
                status: "processing beatmaps",
                text: `processing ${split[split.length - 1]}`,
                index,
                length: processor_input.length,
                small: "this might take a while"
            });
        });

        // shouldn't happen (unless we have a invalid beatmap object)
        if (!processed_beatmaps) {
            console.error("[indexer] failed to get processed beatmaps");
            window?.webContents.send("process", { show: false });
            return new Map();
        }

        const successful_beatmaps = processed_beatmaps.filter((beatmap) => beatmap.success);

        if (successful_beatmaps.length > 0) {
            insert_beatmaps(successful_beatmaps);
        }

        const failed_beatmaps = processed_beatmaps.length - successful_beatmaps.length;

        if (failed_beatmaps > 0) {
            console.log("failed to proccess", failed_beatmaps, "beamtaps");
        }
    }

    // prevent renderer race condition
    await new Promise((r) => setTimeout(r, 100));

    window?.webContents.send("process", { show: false });

    const extra_info_map = new Map(existing_info);

    // create a new map object so we can append this data to the main beatmap array
    for (let i = 0; i < processed_beatmaps.length; i++) {
        const processed = processed_beatmaps[i];

        if (!processed.success) {
            continue;
        }

        extra_info_map.set(processed.md5, {
            audio_path: processed.audio_path,
            image_path: processed.image_path,
            duration: processed.duration
        });
    }

    return extra_info_map;
};

export const get_data = (md5) => {
    const query = database.prepare(`
        SELECT * FROM extra WHERE md5 = ?
    `);

    return query.get(md5);
};

export const get_multiple_data = (md5_array) => {
    if (!md5_array || md5_array.length == 0) {
        return new Map();
    }

    const extra_info_map = new Map();

    for (let i = 0; i < md5_array.length; i += BATCH_SIZE) {
        const batch = md5_array.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => "?").join(",");

        const query = database.prepare(`
            SELECT * FROM extra WHERE md5 IN (${placeholders})
        `);

        const results = query.all(...batch);

        for (const result of results) {
            extra_info_map.set(result.md5, {
                audio_path: result.audio_path,
                image_path: result.image_path,
                duration: result.duration
            });
        }
    }

    return extra_info_map;
};

export const check_saved_beatmaps = (beatmaps) => {
    const md5_array = beatmaps.map((b) => b.md5);
    return get_multiple_data(md5_array);
};
