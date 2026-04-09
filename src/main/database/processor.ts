import { BeatmapRow, ExtractedData, GenericResult } from "@shared/types";
import { BaseTable, dbSchema } from "./database.js";
import { get_window, throttle } from "../utils.js";
import { send_to_renderer } from "../ipc.js";
import { BrowserWindow } from "electron";

export class ProcessedDB extends BaseTable<BeatmapRow> {
    readonly name = "processed";
    readonly schema: dbSchema<BeatmapRow> = {
        md5: { type: "TEXT", primary: true, default: "", nullable: false },
        last_modified: { type: "TEXT", default: "", nullable: false },
        background: { type: "TEXT", default: "", nullable: true },
        audio: { type: "TEXT", default: "", nullable: true },
        video: { type: "TEXT", default: "", nullable: true },
        duration: { type: "INTEGER", default: 0, nullable: true }
    };

    is_processing: boolean = false;
    last_event_data: { status: string; large_text: string; small_text: string; index: number; length: number } | null = null;
    window!: BrowserWindow;

    initialize() {
        this.create_table();

        this.prepare(
            "insert_beatmap",
            `INSERT OR REPLACE INTO ${this.name} (md5, last_modified, background, audio, video, duration) VALUES (?, ?, ?, ?, ?, ?)`
        );

        this.prepare("get_by_md5", `SELECT md5, last_modified, background, audio, video, duration FROM ${this.name} WHERE md5 = ?`);
        this.prepare("check_exists", `SELECT last_modified FROM ${this.name} WHERE md5 = ? LIMIT 1`);
        this.prepare("get_all", `SELECT md5, last_modified, background, audio, video, duration FROM ${this.name}`);

        this.window = get_window("main");
    }

    get_all_beatmaps(): BeatmapRow[] {
        try {
            return this.stmt("get_all")!.all() as BeatmapRow[];
        } catch (error) {
            console.error("[processor] failed to get all beatmaps:", error);
            return [];
        }
    }

    insert_beatmaps(beatmaps: BeatmapRow[]) {
        const insert = this.stmt("insert_beatmap")!;

        const transaction = this.get_db().transaction((beatmaps: BeatmapRow[]) => {
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
            const result = this.stmt("get_by_md5")!.get(md5) as BeatmapRow | undefined;

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
            const result = this.stmt("check_exists")!.get(md5) as BeatmapRow;

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
        this.is_processing = true;
        const window = this.window;

        if (window) {
            send_to_renderer(window.webContents, "processor:events", { type: "start" });
            console.log("showing progress...");
        }
    };

    hide_on_renderer = () => {
        this.is_processing = false;
        this.last_event_data = null;
        const window = this.window;

        if (window) {
            send_to_renderer(window.webContents, "processor:events", { type: "finish" });
            console.log("hiding progress...");
        }
    };

    update_on_renderer = throttle((index: number, length: number) => {
        this.last_event_data = {
            status: "processing...",
            large_text: `processing ${index}`,
            small_text: "this might take a while",
            index,
            length
        };

        const window = this.window;

        if (window) {
            send_to_renderer(window.webContents, "processor:events", {
                type: "update",
                data: this.last_event_data
            });
        } else {
            console.log("process update:", index);
        }
    }, 50);

    get_renderer_state = () => {
        return {
            processing: this.is_processing,
            data: this.last_event_data
        };
    };
}

export const beatmap_processor = new ProcessedDB();
