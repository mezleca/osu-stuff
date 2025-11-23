import { BeatmapRow, ExtractedData, GenericResult, ProcessorInput, ProcessorResult } from "@shared/types";
import { BaseDatabase } from "./database.js";
import { get_app_path, get_window } from "./utils.js";

import Processor from "../../../build/Release/processor.node";
import { send_to_renderer } from "../ipc.js";

const BATCH_SIZE = 999;
const IS_TESTING: boolean = process.env["NODE_ENV"] == "test"; // TODO: move to globals

export class ProcessorDatabase extends BaseDatabase {
    constructor() {
        super("processed.db", get_app_path());
    }

    initialize() {}

    create_tables() {
        this.exec(`
            CREATE TABLE IF NOT EXISTS beatmaps (
                md5 TEXT PRIMARY KEY,
                unique_id TEXT NOT NULL,
                last_modified TEXT NOT NULL,
                background TEXT DEFAULT '',
                duration INTEGER DEFAULT 0
            );
        `);
    }

    prepare_statements() {
        this.prepare_statement(
            "insert_beatmap",
            `INSERT OR REPLACE INTO beatmaps 
            (md5, unique_id, last_modified, background, duration) 
            VALUES (?, ?, ?, ?, ?)`
        );

        this.prepare_statement(
            "get_by_md5",
            `SELECT unique_id, last_modified, background, duration 
            FROM beatmaps WHERE md5 = ?`
        );

        this.prepare_statement("check_exists", `SELECT last_modified FROM beatmaps WHERE md5 = ? LIMIT 1`);
    }

    post_initialize() {}

    get_beatmap(md5: string): GenericResult<ExtractedData> {
        try {
            const result = this.get_statement("get_by_md5").get(md5) as BeatmapRow | undefined;

            if (!result) {
                return { success: false, reason: "beatmap not found" };
            }

            return { success: true, data: { ...result } };
        } catch (error) {
            console.error("[processor] failed to get beatmap:", error);
            return { success: false, reason: "database query failed" };
        }
    }

    // check if beatmap exists and if last_modified matches
    needs_processing(md5: string, last_modified: string): boolean {
        try {
            const result = this.get_statement("check_exists").get(md5);

            if (!result) {
                return true;
            }

            // if last_modified changed, needs reprocessing
            return result.last_modified != last_modified;
        } catch (error) {
            console.error("[processor] failed to check beatmap:", error);
            return true;
        }
    }

    async process_beatmaps(beatmaps: ProcessorInput[]): Promise<GenericResult<Map<string, ExtractedData>>> {
        if (Processor.is_processing()) {
            console.error("[processor] already processing");
            return { success: false, reason: "processor is already running" };
        }

        if (!beatmaps || beatmaps.length === 0) {
            console.log("[processor] no beatmaps to process");
            return { success: true, data: new Map() };
        }

        const window = IS_TESTING ? null : get_window("main");

        // filter beatmaps that need processing
        const to_process: ProcessorInput[] = [];
        const already_processed: string[] = [];

        for (let i = 0; i < beatmaps.length; i++) {
            const beatmap = beatmaps[i];
            const last_modified = beatmap.last_modified || "";

            if (this.needs_processing(beatmap.md5, last_modified)) {
                to_process.push(beatmap);
            } else {
                already_processed.push(beatmap.md5);
            }
        }

        if (already_processed.length > 0) {
            console.log(`[processor] ${already_processed.length} beatmaps already processed`);
        }

        if (to_process.length === 0) {
            console.log("[processor] all beatmaps already processed");
            return this.get_all_from_list(beatmaps.map((b) => b.md5));
        }

        const suffix = to_process.length > 1 ? "s" : "";
        console.log(`[processor] processing ${to_process.length} beatmap${suffix}`);

        // show processing screen
        if (window) {
            send_to_renderer(window.webContents, "processor:events", { type: "start" });
        }

        const processor_result = await this.run_processor(to_process);

        if (!processor_result.success) {
            // hide processing screen
            if (window) {
                send_to_renderer(window.webContents, "processor:events", { type: "finish" });
            }

            return { success: false, reason: processor_result.reason };
        }

        const processed = processor_result.data;

        if (processed.length > 0) {
            try {
                // update last_modified before saving
                for (let i = 0; i < processed.length; i++) {
                    const beatmap = processed[i];
                    const last_modified = beatmap.last_modified || "";

                    if (last_modified == "") {
                        console.warn("last modified is empty...");
                    }

                    this.get_statement("insert_beatmap").run(
                        beatmap.md5,
                        beatmap.unique_id,
                        last_modified,
                        beatmap.data.background,
                        beatmap.data.duration
                    );
                }

                console.log(`[processor] saved ${processed.length} beatmaps to database`);
            } catch (error) {
                console.error("[processor] failed to save beatmaps:", error);

                // hide processing screen
                if (window) {
                    send_to_renderer(window.webContents, "processor:events", { type: "finish" });
                }

                return { success: false, reason: "failed to save to database" };
            }
        }

        // hide processing screen
        if (window) {
            send_to_renderer(window.webContents, "processor:events", { type: "finish" });
        }

        return this.get_all_from_list(beatmaps.map((b) => b.md5));
    }

    private get_all_from_list(md5_list: string[]): GenericResult<Map<string, ExtractedData>> {
        const result_map = new Map<string, ExtractedData>();

        try {
            for (let i = 0; i < md5_list.length; i += BATCH_SIZE) {
                const batch = md5_list.slice(i, i + BATCH_SIZE);
                const placeholders = batch.map(() => "?").join(",");

                const query = this.instance.prepare(`
                    SELECT * FROM beatmaps WHERE md5 IN (${placeholders})
                `);

                const results = query.all(...batch) as BeatmapRow[];

                for (let j = 0; j < results.length; j++) {
                    const row = results[j];
                    result_map.set(row.md5, {
                        duration: row.duration ?? 0,
                        background: row.background
                    });
                }
            }

            return { success: true, data: result_map };
        } catch (error) {
            console.error("[processor] failed to fetch beatmaps:", error);
            return { success: false, reason: "database query failed" };
        }
    }

    private async run_processor(beatmaps: ProcessorInput[]): Promise<GenericResult<ProcessorResult[]>> {
        try {
            const window = IS_TESTING ? null : get_window("main");

            const result = await Processor.process_beatmaps(beatmaps, (index: number) => {
                const file_path = beatmaps[index].file_path;
                const file_name = file_path.split("/").pop() || file_path;

                // send renderer update if possible
                if (window) {
                    send_to_renderer(window?.webContents, "processor:events", {
                        type: "update",
                        data: {
                            status: "processing...",
                            large_text: `processing ${file_name}`,
                            small_text: "this might take a while",
                            index: index,
                            length: beatmaps.length
                        }
                    });
                }
            });

            if (!result) {
                return { success: false, reason: "processor returned null" };
            }

            // filter successful results
            const successful: ProcessorResult[] = [];
            let failed_count = 0;

            for (let i = 0; i < result.length; i++) {
                const item = result[i];

                if (item.success) {
                    successful.push({
                        md5: item.md5,
                        unique_id: item.unique_id,
                        data: item.data,
                        last_modified: item.last_modified
                    });
                } else {
                    failed_count++;
                    console.error(`[processor] failed to process ${item.md5}: ${item.reason}`);
                }
            }

            if (failed_count > 0) {
                console.log(`[processor] failed to process ${failed_count} beatmaps`);
            }

            return { success: true, data: successful };
        } catch (error) {
            console.error("[processor] processor crashed:", error);
            return { success: false, reason: "processor crashed" };
        }
    }
}

export const beatmap_processor = new ProcessorDatabase();
