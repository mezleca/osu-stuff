import { app } from "electron";
import { pathToFileURL } from "url";
import type { BeatmapRow } from "@shared/types";
import { process_beatmap_task_inline, type BeatmapTask } from "@worker/beatmap_worker";

import fs from "fs";
import os from "os";
import path from "path";

type ProcessBeatmapResult = BeatmapRow | null;

type TinypoolType = {
    run: <T>(task: T) => Promise<ProcessBeatmapResult>;
    destroy: () => Promise<void>;
};

const MAX_WORKER_THREADS = 4;

let pool_promise: Promise<TinypoolType> | null = null;

const get_max_threads = (): number => {
    const threads = typeof os.availableParallelism == "function" ? os.availableParallelism() : os.cpus().length;
    const usable_threads = Math.max(1, threads - 1);
    return Math.min(MAX_WORKER_THREADS, usable_threads);
};

// TOFIX: this sucks
const WORKER_RELATIVE_PATH = path.join("out", "worker", "beatmap_worker.mjs");

const get_worker_file = (): string => {
    if (!app.isPackaged) {
        // ...
        const non_packaged_worker_file = path.resolve(__dirname, "..", "..", "..", WORKER_RELATIVE_PATH);

        if (!fs.existsSync(WORKER_RELATIVE_PATH)) {
            throw new Error(`beatmap worker not found at: ${non_packaged_worker_file}`);
        }

        return non_packaged_worker_file;
    }

    const packaged_worker_file = path.resolve(process.resourcesPath, "app.asar.unpacked", WORKER_RELATIVE_PATH);

    if (!fs.existsSync(packaged_worker_file)) {
        throw new Error(`beatmap worker not found at: ${packaged_worker_file}`);
    }

    return packaged_worker_file;
};

const get_pool = async (): Promise<TinypoolType> => {
    if (!pool_promise) {
        pool_promise = (async () => {
            const { default: Tinypool } = await import("tinypool");
            const worker_file = get_worker_file();

            return new Tinypool({
                filename: pathToFileURL(worker_file).href,
                minThreads: 1,
                maxThreads: get_max_threads()
            });
        })();
    }

    return pool_promise;
};

export const process_beatmap_task = async (task: BeatmapTask): Promise<ProcessBeatmapResult> => {
    if (process.env.NODE_ENV == "test") {
        return process_beatmap_task_inline(task);
    }

    const pool = await get_pool();
    return pool.run(task);
};

export const destroy_beatmap_pool = async (): Promise<void> => {
    if (!pool_promise) {
        return;
    }

    const pool = await pool_promise;
    await pool.destroy();
    pool_promise = null;
};
