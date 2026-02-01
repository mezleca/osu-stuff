import {
    DownloadUpdate,
    GenericResult,
    IBeatmapDownloader,
    IDownloadData,
    IDownloadedBeatmap,
    IMirrorWithCooldown,
    IBeatmapResult
} from "@shared/types";
import { config } from "../database/config";
import { mirrors } from "../database/mirrors";
import { send_to_renderer } from "../ipc";
import { get_window } from "../database/utils";
import { get_driver } from "./drivers/driver";
import { v2 } from "osu-api-extended";

import path from "path";
import fs from "fs";

const MAX_PARALLEL_DOWNLOADS = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

const get_save_path = (): string => {
    const lazer_mode = config.get().lazer_mode;

    if (lazer_mode) {
        return config.get().export_path;
    }

    if (!lazer_mode && config.get().stable_songs_path) {
        return config.get().stable_songs_path;
    }

    // fallback to export path
    return config.get().export_path;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parallel_map = async <T, R>(array: T[], mapper: (item: T, index: number) => Promise<R | { stop: true }>, concurrency: number): Promise<R[]> => {
    const results: R[] = [];
    let index = 0;
    let should_stop = false;

    const run = async (): Promise<void> => {
        while (index < array.length && !should_stop) {
            const current_index = index++;

            try {
                const result = await mapper(array[current_index], current_index);

                if (result && typeof result === "object" && "stop" in result) {
                    should_stop = true;
                    return;
                }

                results[current_index] = result as R;
            } catch (error) {
                console.log(`[downloader] error at index ${current_index}:`, error);
            }
        }
    };

    await Promise.all(
        Array(Math.min(concurrency, array.length))
            .fill(null)
            .map(() => run())
    );

    return results;
};

class BeatmapDownloader implements IBeatmapDownloader {
    private mirrors_with_cooldown: Map<string, IMirrorWithCooldown> = new Map();
    private initialized: boolean = false;
    private queue: Map<string, IDownloadData> = new Map();
    private current_download_id: string | null = null;

    update_mirrors(): void {
        const db_mirrors = mirrors.get();

        for (const mirror of db_mirrors) {
            if (!this.mirrors_with_cooldown.has(mirror.name)) {
                this.mirrors_with_cooldown.set(mirror.name, {
                    name: mirror.name,
                    url: mirror.url,
                    cooldown: null
                });
            } else {
                const existing = this.mirrors_with_cooldown.get(mirror.name)!;
                existing.url = mirror.url;
            }
        }

        // remove mirrors that dont exist in db anymore
        const db_names = new Set(db_mirrors.map((m) => m.name));

        for (const [name] of this.mirrors_with_cooldown) {
            if (!db_names.has(name)) {
                this.mirrors_with_cooldown.delete(name);
            }
        }
    }

    initialize(): void {
        console.log("[downloader] initializing");
        this.update_mirrors();
        this.initialized = true;
    }

    is_initialized(): boolean {
        return this.initialized;
    }

    has_mirrors(): boolean {
        return this.mirrors_with_cooldown.size > 0;
    }

    get_queue(): IDownloadData[] {
        return Array.from(this.queue.values());
    }

    is_active(): boolean {
        if (!this.current_download_id) {
            return false;
        }

        const current = this.queue.get(this.current_download_id);

        if (!current) {
            return false;
        }

        return current.progress?.paused || false;
    }

    async add_single(data: IDownloadedBeatmap): Promise<boolean> {
        console.log("[downloader] single download started");
        return this.process_beatmap(data);
    }

    add_to_queue(data: IDownloadData): boolean {
        if (!this.has_mirrors()) {
            console.log("[downloader] no mirrors");
            return false;
        }

        // check for duplicate
        if (this.queue.has(data.id)) {
            console.log("[downloader] download already exists:", data.id);
            return false;
        }

        if (!data.progress) {
            data.progress = {
                id: data.id,
                paused: this.current_download_id !== null,
                length: data.beatmaps.length,
                current: 0
            };
        }

        this.queue.set(data.id, data);

        if (!this.current_download_id) {
            setTimeout(() => this.start_next_download(), 100);
        }

        return true;
    }

    resume(id: string): boolean {
        const download = this.queue.get(id);

        if (!download) {
            console.log("[downloader] download not found:", id);
            return false;
        }

        // pause current if different
        if (this.current_download_id && this.current_download_id !== id) {
            this.pause(this.current_download_id);
        }

        if (download.progress) {
            download.progress.paused = false;
        }

        this.start_download(id);
        return true;
    }

    pause(id: string): boolean {
        const download = this.queue.get(id);

        if (!download) {
            console.log("[downloader] download not found:", id);
            return false;
        }

        if (download.progress) {
            download.progress.paused = true;
        }

        console.log("[downloader] paused:", id);
        this.notify_update("paused");

        return true;
    }

    remove_from_queue(id: string): boolean {
        const download = this.queue.get(id);

        if (!download) {
            console.log("[downloader] download not found:", id);
            return false;
        }

        // start new download if possible
        if (this.current_download_id === id) {
            this.pause(id);
            this.current_download_id = null;
            setTimeout(() => this.start_next_download(), 100);
        }

        // otherwise, just delete it
        this.queue.delete(id);
        console.log("[downloader] removed from queue:", id);

        return true;
    }

    // TOFIX: handle auth errors
    private start_download(id: string): void {
        if (this.current_download_id) {
            console.log("[downloader] another download is processing");
            return;
        }

        const download = this.queue.get(id);

        if (!download) {
            console.log("[downloader] download not found:", id);
            return;
        }

        // if the user for some reason deleted all of the mirrors while downloading
        // pause the current download and notify the renderer
        if (!this.has_mirrors()) {
            if (download.progress) download.progress.paused = true;
            console.log("[downloader] no mirrors available");
            this.notify_update("no mirrors");
            return;
        }

        console.log("[downloader] processing:", id);

        this.current_download_id = id;

        if (download.progress) {
            download.progress.paused = false;
        }

        this.notify_update("resumed");

        this.process_download(download).then((stopped) => {
            if (stopped) {
                console.log("[downloader] download paused:", id);
                this.notify_update("paused");
                if (this.current_download_id == id) {
                    this.current_download_id = null;
                }
                return;
            }

            console.log("[downloader] download completed:", id);

            // notify before cleanup so the event actually gets sent
            this.notify_update("finished");

            this.queue.delete(id);
            if (this.current_download_id == id) {
                this.current_download_id = null;
            }

            setTimeout(() => this.start_next_download(), 100);
        });
    }

    private async process_download(download: IDownloadData): Promise<boolean> {
        let stopped = false;
        const start_index = download.progress?.current ?? 0;
        const remaining_beatmaps = download.beatmaps.slice(start_index);
        let completed_count = start_index;

        await parallel_map(
            remaining_beatmaps,
            async (beatmap) => {
                if (download.progress?.paused) {
                    stopped = true;
                    return { stop: true };
                }

                if (!this.queue.has(download.id)) {
                    return { stop: true };
                }

                await this.process_beatmap(beatmap);

                // tiny delay to keep things fast but stable
                await sleep(50);

                if (download.progress) {
                    completed_count++;
                    download.progress.current = completed_count;
                    this.notify_update("update");
                }

                return true;
            },
            MAX_PARALLEL_DOWNLOADS
        );

        return stopped;
    }

    private async get_beatmap_info(beatmap: IDownloadedBeatmap): Promise<GenericResult<IBeatmapResult>> {
        const md5 = beatmap.md5;

        if (!md5) {
            return { success: false, reason: "missing md5" };
        }

        try {
            const result = await v2.beatmaps.lookup({ type: "difficulty", checksum: md5 });

            if (result.error) {
                console.log(`[downloader] lookup error for ${md5}:`, result.error);
                return { success: false, reason: result.error.message };
            }

            const mapped: IBeatmapResult = {
                md5: result.checksum,
                online_id: result.id,
                beatmapset_id: result.beatmapset_id,
                title: result.beatmapset?.title || "",
                artist: result.beatmapset?.artist || "",
                creator: result.beatmapset?.creator || "",
                difficulty: result.version,
                status: result.status,
                mode: result.mode,
                temp: false,
                ar: result.ar,
                cs: result.cs,
                hp: result.drain,
                od: result.accuracy,
                star_rating: result.difficulty_rating,
                bpm: result.bpm,
                length: result.total_length,
                last_modified: new Date().toISOString(),
                background: "",
                audio: "",
                tags: result.beatmapset?.tags || ""
            };

            return { success: true, data: mapped };
        } catch (err) {
            console.error(`[downloader] lookup exception for ${md5}:`, err);
            return { success: false, reason: String(err) };
        }
    }

    private async process_beatmap(beatmap: IDownloadedBeatmap): Promise<boolean> {
        const result = await this.get_beatmap_info(beatmap);

        // TODO: notify :3
        if (!result.success) {
            console.log("[downloader] failed to process beatmap:", result.reason);
            return false;
        }

        const beatmap_info = result.data;
        const id = beatmap_info.beatmapset_id;
        const save_path = get_save_path();
        const folder_path = path.resolve(save_path, String(id));
        const file_path = path.resolve(save_path, `${id}.osz`);

        if (fs.existsSync(folder_path) || fs.existsSync(file_path)) {
            console.log("[downloader] file already exists:", id);
            return false;
        }

        const buffer = await this.download_from_mirrors(id);

        if (!buffer) {
            console.log("[downloader] failed to download:", id);
            return false;
        }

        const driver = get_driver();

        // write beatmap data
        await this.save_beatmap(buffer, file_path);

        // add beatmap to static temp beatmaps
        driver.add_beatmap(beatmap_info);

        return true;
    }

    private async download_from_mirrors(beatmap_id: number): Promise<ArrayBuffer | null> {
        const mirrors = Array.from(this.mirrors_with_cooldown.values());

        for (const mirror of mirrors) {
            if (mirror.cooldown && mirror.cooldown > Date.now()) {
                continue;
            }

            if (mirror.cooldown && mirror.cooldown <= Date.now()) {
                mirror.cooldown = null;
                console.log("[downloader] cooldown removed:", mirror.name);
            }

            let url = mirror.url;
            if (url.endsWith("/")) {
                url = url.slice(0, -1);
            }

            try {
                const response = await fetch(`${url}/${beatmap_id}`);

                if (response.status === 429) {
                    mirror.cooldown = Date.now() + COOLDOWN_MS;
                    console.log("[downloader] rate limited:", mirror.name);
                    continue;
                }

                if (response.ok) {
                    return await response.arrayBuffer();
                }
            } catch (error) {
                console.log("[downloader] error downloading from", mirror.name, error);
            }
        }

        return null;
    }

    private async save_beatmap(buffer: ArrayBuffer, file_path: string): Promise<void> {
        try {
            fs.mkdirSync(path.dirname(file_path), { recursive: true });
            fs.writeFileSync(file_path, Buffer.from(buffer));
        } catch (error) {
            console.log("[downloader] error saving file:", error);
        }
    }

    private start_next_download(): void {
        // get the next download in the queue (first one that's paused or any remaining)
        for (const [id, download] of this.queue) {
            if (download.progress) {
                download.progress.paused = false;
            }
            this.start_download(id);
            return;
        }
    }

    private notify_update(type: DownloadUpdate): void {
        if (!this.current_download_id || process.env.NODE_ENV == "test") {
            return;
        }

        const window = get_window("main");
        const download = this.queue.get(this.current_download_id);

        if (!download) {
            return;
        }

        if (!download.progress) {
            console.warn("skipping notify update, missing progress shit");
            return;
        }

        send_to_renderer(window.webContents, "downloader:events", { data: download.progress, type });
    }
}

export const beatmap_downloader = new BeatmapDownloader();
