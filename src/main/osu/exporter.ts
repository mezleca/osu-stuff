import { get_client } from "./clients/client";
import { get_window } from "../utils";
import type { ExportEvent, ExportOptions, IExportState, IOsuClient } from "@shared/types";

class BeatmapExporter {
    private id: string = "";
    private queue: number[] = [];
    private current_index: number = 0;
    private exporting: boolean = false;
    private current_beatmap: string = "";
    private client: IOsuClient | null = null;

    start = async (options: ExportOptions) => {
        if (this.is_exporting()) {
            console.log("[exporter] already exporting");
            this.notify({ id: options.id, type: "stopped", reason: "already exporting" });
            return;
        }

        this.id = options.id;
        this.queue = [];
        this.current_index = 0;
        this.current_beatmap = "";
        const set_queue = new Set<number>();

        // get current active client
        this.client = get_client();

        for (const name of options.collections) {
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
            this.stop("no beatmaps found");
            return;
        }

        this.exporting = true;
        this.notify({ id: this.id, type: "started", total: this.queue.length });
        this.process();
    };

    stop = (reason: string = "cancelled by user", id: string = this.id) => {
        if (id != this.id) {
            return;
        }

        if (!this.is_exporting() && reason == "cancelled by user") {
            return;
        }

        this.exporting = false;
        this.queue = [];
        this.client = null;
        this.notify({ id: this.id, type: "stopped", reason });
    };

    get_state = (): IExportState => {
        return {
            is_exporting: this.exporting,
            id: this.id,
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
            this.notify({ id: this.id, type: "finished", count: this.queue.length });
            return;
        }

        const id = this.queue[this.current_index];
        if (id == null) {
            this.stop("invalid export queue state");
            return;
        }

        this.current_beatmap = `beatmapset #${id}`;

        this.notify({
            id: this.id,
            type: "progress",
            current: this.current_index + 1,
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

    private notify = (data: ExportEvent) => {
        const window = get_window("main");
        if (window && !window.isDestroyed()) {
            window.webContents.send("export:event", data);
        }
    };
}

export const beatmap_exporter = new BeatmapExporter();
