import { get_client } from "./clients/client";
import { get_window } from "../utils";
import type { IOsuClient } from "@shared/types";

interface IExportState {
    is_exporting: boolean;
    current_index: number;
    total: number;
    current_beatmap: string;
}

class BeatmapExporter {
    private queue: number[] = [];
    private current_index: number = 0;
    private exporting: boolean = false;
    private current_beatmap: string = "";
    private client: IOsuClient | null = null;

    start = async (collections: string[]) => {
        if (this.is_exporting()) {
            console.log("[exporter] already exporting");
            return;
        }

        this.queue = [];
        this.current_index = 0;
        const set_queue = new Set<number>();

        // get current active client
        this.client = get_client();

        for (const name of collections) {
            const collection = this.client.get_collection(name);
            if (collection) {
                for (const md5 of collection.beatmaps) {
                    const beatmap = await this.client.get_beatmap_by_md5(md5);
                    if (beatmap && beatmap.beatmapset_id) {
                        set_queue.add(beatmap.beatmapset_id);
                    }
                }
            }
        }

        this.queue = Array.from(set_queue);

        if (this.queue.length == 0) {
            this.notify("export:finish", { success: false, reason: "no beatmaps found" });
            return;
        }

        this.exporting = true;
        this.process();
    };

    cancel = () => {
        if (!this.is_exporting()) return;
        this.exporting = false;
        this.queue = [];
        this.client = null;
        this.notify("export:finish", { success: false, reason: "cancelled by user" });
    };

    get_state = (): IExportState => {
        return {
            is_exporting: this.exporting,
            current_index: this.current_index,
            total: this.queue.length,
            current_beatmap: this.current_beatmap
        };
    };

    is_exporting = (): boolean => {
        return this.exporting;
    };

    private process = async () => {
        if (!this.is_exporting() || !this.client) return;

        if (this.current_index >= this.queue.length) {
            this.exporting = false;
            this.client = null;
            this.notify("export:finish", { success: true, count: this.queue.length });
            return;
        }

        const id = this.queue[this.current_index];
        if (id == null) {
            this.exporting = false;
            this.client = null;
            this.notify("export:finish", { success: false, reason: "invalid export queue state" });
            return;
        }

        this.current_beatmap = `beatmapset #${id}`;

        // notify progress
        this.notify("export:update", {
            current: this.current_index,
            total: this.queue.length,
            text: `exporting ${this.current_beatmap}`
        });

        const success = await this.client.export_beatmapset(id);

        if (!success) {
            console.warn(`[exporter] failed to export ${id}`);
        }

        this.current_index++;

        // continue to next
        // use setImmediate to allow loop to breathe
        setTimeout(() => this.process(), 10);
    };

    private notify = (channel: string, data: any) => {
        const window = get_window("main");
        if (window && !window.isDestroyed()) {
            window.webContents.send(channel, data);
        }
    };
}

export const beatmap_exporter = new BeatmapExporter();
