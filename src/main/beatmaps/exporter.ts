import { get_driver } from "../database/drivers/driver";
import { get_window } from "../database/utils";
import type { IOsuDriver } from "@shared/types";

interface IExportState {
    is_exporting: boolean;
    current_index: number;
    total: number;
    current_beatmap: string;
}

class BeatmapExporter {
    private queue: Set<Number> = new Set();
    private current_index: number = 0;
    private is_exporting: boolean = false;
    private current_beatmap: string = "";
    private driver: IOsuDriver | null = null;

    start = async (collections: string[]) => {
        if (this.is_exporting) {
            console.log("[exporter] already exporting");
            return;
        }

        this.queue = new Set();
        this.current_index = 0;

        // get current active driver
        this.driver = get_driver();

        for (const name of collections) {
            const collection = this.driver.get_collection(name);
            if (collection) {
                for (const md5 of collection.beatmaps) {
                    const beatmap = await this.driver.get_beatmap_by_md5(md5);
                    if (beatmap && beatmap.beatmapset_id) {
                        this.queue.add(beatmap.beatmapset_id);
                    }
                }
            }
        }

        if (this.queue.size == 0) {
            this.notify("export:finish", { success: false, reason: "no beatmaps found" });
            return;
        }

        this.is_exporting = true;
        this.process();
    };

    cancel = () => {
        if (!this.is_exporting) return;
        this.is_exporting = false;
        this.queue = new Set();
        this.driver = null;
        this.notify("export:finish", { success: false, reason: "cancelled by user" });
    };

    get_state = (): IExportState => {
        return {
            is_exporting: this.is_exporting,
            current_index: this.current_index,
            total: this.queue.size,
            current_beatmap: this.current_beatmap
        };
    };

    private process = async () => {
        if (!this.is_exporting || !this.driver) return;

        if (this.current_index >= this.queue.size) {
            this.is_exporting = false;
            this.driver = null;
            this.notify("export:finish", { success: true, count: this.queue.size });
            return;
        }

        const id = this.queue[this.current_index];
        this.current_beatmap = `beatmapset #${id}`;

        // notify progress
        this.notify("export:update", {
            current: this.current_index,
            total: this.queue.size,
            text: `exporting ${this.current_beatmap}`
        });

        const success = await this.driver.export_beatmapset(id);

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
