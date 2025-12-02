import { BeatmapRow, ExtractedData, GenericResult } from "@shared/types";
import { BaseDatabase } from "./database.js";
import { get_app_path, throttle } from "./utils.js";
import { send_to_renderer } from "../ipc.js";
import { BrowserWindow } from "electron";

export class ProcessorDatabase extends BaseDatabase {
    is_processing: boolean = false;
    window!: BrowserWindow;

    constructor() {
        super("processed.db", get_app_path());
    }

    initialize() {}

    set_window(window: BrowserWindow) {
        this.window = window;
    }

    create_tables() {
        this.exec(`
            CREATE TABLE IF NOT EXISTS beatmaps (
                md5 TEXT PRIMARY KEY,
                last_modified TEXT NOT NULL,
                background TEXT DEFAULT '',
                audio TEXT DEFAULT '',
                video TEXT DEFAULT '',
                duration INTEGER DEFAULT 0
            );
        `);
    }

    prepare_statements() {
        if (
            !this.prepare_statement(
                "insert_beatmap",
                `INSERT OR REPLACE INTO beatmaps 
            (md5, last_modified, background, audio, video, duration) 
            VALUES (?, ?, ?, ?, ?, ?)`
            )
        )
            return false;

        if (
            !this.prepare_statement(
                "get_by_md5",
                `SELECT md5, last_modified, background, audio, video, duration 
            FROM beatmaps WHERE md5 = ?`
            )
        )
            return false;

        if (!this.prepare_statement("check_exists", `SELECT last_modified FROM beatmaps WHERE md5 = ? LIMIT 1`)) return false;

        if (!this.prepare_statement("get_all", `SELECT md5, last_modified, background, audio, video, duration FROM beatmaps`)) return false;

        return true;
    }

    get_all_beatmaps(): BeatmapRow[] {
        try {
            return this.get_statement("get_all").all() as BeatmapRow[];
        } catch (error) {
            console.error("[processor] failed to get all beatmaps:", error);
            return [];
        }
    }

    insert_beatmaps(beatmaps: BeatmapRow[]) {
        const insert = this.get_statement("insert_beatmap");

        const transaction = this.instance.transaction((beatmaps: BeatmapRow[]) => {
            for (const beatmap of beatmaps) {
                insert.run(beatmap.md5, beatmap.last_modified, beatmap.background, beatmap.audio, beatmap.video, beatmap.duration);
            }
        });

        try {
            transaction(beatmaps);
            return true;
        } catch (error) {
            console.error("[processor] failed to insert beatmaps:", error);
            return false;
        }
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

    show_on_renderer = () => {
        const window = this.window;

        if (window) {
            send_to_renderer(window.webContents, "processor:events", { type: "start" });
            console.log("showing progress...");
        }
    };

    hide_on_renderer = () => {
        const window = this.window;

        if (window) {
            send_to_renderer(window.webContents, "processor:events", { type: "finish" });
            console.log("hiding progress...");
        }
    };

    update_on_renderer = throttle((index: number, length: number) => {
        const window = this.window;

        if (window) {
            send_to_renderer(window.webContents, "processor:events", {
                type: "update",
                data: {
                    status: "processing...",
                    large_text: `processing ${index}`,
                    small_text: "this might take a while",
                    index,
                    length
                }
            });
        } else {
            console.log("process update:", index);
        }
    }, 50);
}

export const beatmap_processor = new ProcessorDatabase();
