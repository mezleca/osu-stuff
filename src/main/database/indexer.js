import Processor from "../../../build/Release/processor.node";

import { BaseDatabase } from "./database.js";
import { get_app_path } from "./utils.js";
import { reader } from "../reader/reader.js";
import { config } from "./config.js";

let indexer_db = null;

const BATCH_SIZE = 999;

export class IndexerDatabase extends BaseDatabase {
    constructor() {
        super("indexer.db", get_app_path());
        this.window = null;
    }

    create_tables() {
        this.exec(`
            CREATE TABLE IF NOT EXISTS extra (
                md5 TEXT PRIMARY KEY,
                unique_id TEXT,
                audio_path TEXT,
                image_path TEXT,
                duration INTEGER
            );
        `);
    }

    prepare_statements() {
        this.prepare_statement(
            "add_beatmap",
            `
            INSERT OR REPLACE INTO extra
            (md5, unique_id, audio_path, image_path, duration)
            VALUES (?, ?, ?, ?, ?)
        `
        );

        this.prepare_statement(
            "get_single",
            `
            SELECT * FROM extra WHERE md5 = ?
        `
        );
    }

    post_initialize() {
        // create transaction for batch inserts
        this.insert_beatmaps = this.database.transaction((beatmaps) => {
            const statement = this.get_statement("add_beatmap");
            for (const beatmap of beatmaps) {
                statement.run(beatmap.md5, beatmap.unique_id, beatmap.audio_path, beatmap.image_path, beatmap.duration);
            }
        });
    }

    set_window(main_window) {
        this.window = main_window;
    }

    filter_unique_beatmaps(beatmaps_array) {
        const seen_unique_ids = new Set();
        const unique_beatmaps = [];

        for (let i = 0; i < beatmaps_array.length; i++) {
            const beatmap = beatmaps_array[i];

            if (!beatmap.unique_id) {
                continue;
            }

            if (!seen_unique_ids.has(beatmap.unique_id)) {
                seen_unique_ids.add(beatmap.unique_id);
                unique_beatmaps.push(beatmap);
            }
        }

        return unique_beatmaps;
    }

    get_data(md5) {
        return this.get_statement("get_single").get(md5);
    }

    get_saved_beatmap_data(md5_array) {
        if (!md5_array || md5_array.length == 0) {
            return new Map();
        }

        const extra_info_map = new Map();

        for (let i = 0; i < md5_array.length; i += BATCH_SIZE) {
            const batch = md5_array.slice(i, i + BATCH_SIZE);
            const placeholders = batch.map(() => "?").join(",");

            const query = this.database.prepare(`
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
    }

    async process_beatmaps(beatmaps) {
        if (Processor.is_processing()) {
            console.error("[indexer] already processing");
            return null;
        }

        const beatmaps_array = Array.from(beatmaps.values());

        if (!beatmaps_array || beatmaps_array.length == 0) {
            console.log("[indexer] beatmap array == 0");
            return beatmaps;
        }

        await new Promise((r) => setTimeout(r, 20));

        const md5_list = beatmaps_array.map((b) => b.md5);
        const existing_info = this.get_saved_beatmap_data(md5_list);
        const to_process = beatmaps_array.filter((b) => !existing_info.has(b.md5));

        if (to_process.length == 0) {
            console.log("[indexer] 0 beatmaps to process...");
            return beatmaps;
        }

        this.window?.webContents.send("process", { show: true });
        console.log(`[indexer] processing ${to_process.length} new beatmaps`);

        const processor_input = this.prepare_processor_input(to_process);
        const processed_beatmaps = await this.run_processor(processor_input);

        if (!processed_beatmaps) {
            console.error("[indexer] failed to get processed beatmaps");
            this.window?.webContents.send("process", { show: false });
            return new Map();
        }

        const successful_beatmaps = processed_beatmaps.filter((beatmap) => beatmap.success);

        if (successful_beatmaps.length > 0) {
            this.insert_beatmaps(successful_beatmaps);
        }

        const failed_beatmaps = processed_beatmaps.length - successful_beatmaps.length;

        if (failed_beatmaps > 0) {
            console.log("failed to process", failed_beatmaps, "beatmaps");
        }

        // prevent race condition on end
        await new Promise((r) => setTimeout(r, 100));
        this.window?.webContents.send("process", { show: false });

        this.update_beatmap_data(beatmaps, processed_beatmaps, existing_info, beatmaps_array);

        return beatmaps;
    }

    prepare_processor_input(to_process) {
        const processor_input = [];

        for (let i = 0; i < to_process.length; i++) {
            const beatmap = to_process[i];
            const result = {
                md5: beatmap.md5,
                unique_id: beatmap.unique_id
            };

            if (config.lazer_mode) {
                result.file_path = beatmap.file_path;
                result.audio_path = beatmap.audio_path;
                result.image_path = beatmap.image_path;
            } else {
                result.file_path = reader.get_file_location(beatmap);
            }

            processor_input.push(result);
        }

        return processor_input;
    }

    // process beatmaps and send progress to renderer on update
    async run_processor(processor_input) {
        return await Processor.process_beatmaps(processor_input, (index) => {
            const file_name = processor_input[index].file_path;
            const split = file_name.split("/");
            this.window?.webContents.send("process-update", {
                status: "processing beatmaps",
                text: `processing ${split[split.length - 1]}`,
                index,
                length: processor_input.length,
                small: "this might take a while"
            });
        });
    }

    update_beatmap_data(beatmaps, processed_beatmaps, existing_info, beatmaps_array) {
        // update processed beatmaps
        for (let i = 0; i < processed_beatmaps.length; i++) {
            const processed = processed_beatmaps[i];
            const data = beatmaps.get(processed.md5);

            if (!processed.success) {
                continue;
            }

            delete processed.success;
            Object.assign(data, processed);
        }

        // update existing beatmaps
        for (let i = 0; i < beatmaps_array.length; i++) {
            const {md5} = beatmaps_array[i];
            const existing = existing_info.get(md5);

            if (!existing) {
                continue;
            }

            Object.assign(beatmaps_array[i], existing);
        }
    }
}

export const initialize_indexer = async (main_window) => {
    indexer_db = new IndexerDatabase();
    indexer_db.initialize();
    indexer_db.set_window(main_window);
    return indexer_db;
};

export const filter_unique_beatmaps = (beatmaps_array) => {
    return indexer_db?.filter_unique_beatmaps(beatmaps_array);
};

export const process_beatmaps = async (beatmaps) => {
    return await indexer_db?.process_beatmaps(beatmaps);
};

export const get_data = (md5) => {
    return indexer_db?.get_data(md5);
};

export const get_saved_beatmap_data = (md5_array) => {
    return indexer_db?.get_saved_beatmap_data(md5_array);
};
