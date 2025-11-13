import { IProcessorInput, IProcesedBeatmap, IProcessedData, GenericResult } from "@shared/types";
import { BaseDatabase } from "./database.js";
import { get_app_path, get_window } from "./utils.js";

// @ts-ignore
import Processor from "../../../build/Release/processor.node";

const BATCH_SIZE = 999;

export class ProcessorDatabase extends BaseDatabase {
    private insert_batch_stmt: any;

    constructor() {
        super("processed.db", get_app_path());
    }

    initialize() {}

    create_tables() {
        this.exec(`
            CREATE TABLE IF NOT EXISTS beatmaps (
                md5 TEXT PRIMARY KEY,
                unique_id TEXT NOT NULL,
                audio_path TEXT NOT NULL,
                image_path TEXT NOT NULL,
                duration INTEGER NOT NULL
            );
        `);
    }

    prepare_statements() {
        this.prepare_statement(
            "insert_beatmap",
            `INSERT OR REPLACE INTO beatmaps 
            (md5, unique_id, audio_path, image_path, duration) 
            VALUES (?, ?, ?, ?, ?)`
        );

        this.prepare_statement(
            "get_by_md5",
            `SELECT audio_path, image_path, duration 
            FROM beatmaps WHERE md5 = ?`
        );

        this.prepare_statement("check_exists", `SELECT 1 FROM beatmaps WHERE md5 = ? LIMIT 1`);
    }

    post_initialize() {
        const stmt = this.get_statement("insert_beatmap");

        this.insert_batch_stmt = this.instance.transaction((beatmaps: IProcesedBeatmap[]) => {
            for (let i = 0; i < beatmaps.length; i++) {
                const b = beatmaps[i];
                stmt.run(b.md5, b.unique_id, b.audio_path, b.image_path, b.duration);
            }
        });
    }

    get_beatmap(md5: string): GenericResult<IProcessedData> {
        try {
            const result = this.get_statement("get_by_md5").get(md5);

            if (!result) {
                return { success: false, reason: "beatmap not found in database" };
            }

            return {
                success: true,
                data: {
                    audio_path: result.audio_path,
                    image_path: result.image_path,
                    duration: result.duration
                }
            };
        } catch (error) {
            console.error("[processor] failed to get beatmap:", error);
            return { success: false, reason: "database query failed" };
        }
    }

    is_processed(md5: string): boolean {
        try {
            const result = this.get_statement("check_exists").get(md5);
            return !!result;
        } catch (error) {
            console.error("[processor] failed to check beatmap:", error);
            return false;
        }
    }

    async process_beatmaps(beatmaps: IProcessorInput[]): Promise<GenericResult<Map<string, IProcessedData>>> {
        if (Processor.is_processing()) {
            console.error("[processor] already processing beatmaps");
            return { success: false, reason: "processor is already running" };
        }

        if (!beatmaps || beatmaps.length == 0) {
            console.log("[processor] no beatmaps to process");
            return { success: true, data: new Map() };
        }

        const window = get_window("main");

        // filter out already processed beatmaps
        const to_process: IProcessorInput[] = [];
        const already_processed: string[] = [];

        for (let i = 0; i < beatmaps.length; i++) {
            const beatmap = beatmaps[i];

            if (this.is_processed(beatmap.md5)) {
                already_processed.push(beatmap.md5);
            } else {
                to_process.push(beatmap);
            }
        }

        if (already_processed.length > 0) {
            console.log(`[processor] ${already_processed.length} beatmaps already processed`);
        }

        if (to_process.length == 0) {
            console.log("[processor] all beatmaps already processed");
            return this.get_all_from_list(beatmaps.map((b) => b.md5));
        }

        console.log(`[processor] processing ${to_process.length} new beatmaps`);
        window.webContents.send("process", { show: true });

        const processor_result = await this.run_processor(to_process);

        if (!processor_result.success) {
            window.webContents.send("process", { show: false });
            return { success: false, reason: processor_result.reason };
        }

        const processed = processor_result.data;

        if (processed.length > 0) {
            try {
                this.insert_batch_stmt(processed);
                console.log(`[processor] saved ${processed.length} beatmaps to database`);
            } catch (error) {
                console.error("[processor] failed to save beatmaps:", error);
                window.webContents.send("process", { show: false });
                return { success: false, reason: "failed to save beatmaps to database" };
            }
        }

        window.webContents.send("process", { show: false });
        return this.get_all_from_list(beatmaps.map((b) => b.md5));
    }

    private get_all_from_list(md5_list: string[]): GenericResult<Map<string, IProcessedData>> {
        const result_map = new Map<string, IProcessedData>();

        try {
            for (let i = 0; i < md5_list.length; i += BATCH_SIZE) {
                const batch = md5_list.slice(i, i + BATCH_SIZE);
                const placeholders = batch.map(() => "?").join(",");

                const query = this.instance.prepare(`
                    SELECT md5, audio_path, image_path, duration 
                    FROM beatmaps WHERE md5 IN (${placeholders})
                `);

                const results = query.all(...batch);

                for (let j = 0; j < results.length; j++) {
                    const row = results[j];
                    result_map.set(row.md5, {
                        audio_path: row.audio_path,
                        image_path: row.image_path,
                        duration: row.duration
                    });
                }
            }

            return { success: true, data: result_map };
        } catch (error) {
            console.error("[processor] failed to fetch beatmaps:", error);
            return { success: false, reason: "database query failed" };
        }
    }

    private async run_processor(beatmaps: IProcessorInput[]): Promise<GenericResult<IProcesedBeatmap[]>> {
        try {
            const window = get_window("main");
            const result = await Processor.process_beatmaps(beatmaps, (index: number) => {
                const file_path = beatmaps[index].file_path;
                const file_name = file_path.split("/").pop() || file_path;

                window.webContents.send("process-update", {
                    status: "processing beatmaps",
                    text: `processing ${file_name}`,
                    index: index,
                    length: beatmaps.length,
                    small: "this might take a while"
                });
            });

            if (!result) {
                return { success: false, reason: "processor returned null" };
            }

            // filter out failed beatmaps
            const successful: IProcesedBeatmap[] = [];
            let failed_count = 0;

            for (let i = 0; i < result.length; i++) {
                const beatmap = result[i];
                if (beatmap.success) {
                    successful.push({
                        md5: beatmap.md5,
                        unique_id: beatmap.unique_id,
                        audio_path: beatmap.audio_path,
                        image_path: beatmap.image_path,
                        duration: beatmap.duration
                    });
                } else {
                    failed_count++;
                }
            }

            if (failed_count > 0) {
                console.log(`[processor] failed to process ${failed_count} beatmaps`);
            }

            return { success: true, data: successful };
        } catch (error) {
            console.error("[processor] processor crashed:", error);
            return { success: false, reason: "processor crashed..." };
        }
    }
}

export const beatmap_processor = new ProcessorDatabase();
