import { config } from "../database/config";
import { delete_mirror, insert_mirror, update_mirrors } from "../database/mirrors";

import fs from "fs";
import path from "path";

let token = "";
let processing = false;
let main_window = null;

const downloads = [];
const beatmap_cache = new Map();
const MAX_PARALLEL_DOWNLOADS = 3;
const COOLDOWN_MINUTES = 5;

export const send_download_progress = (data, reason) => {
    main_window.webContents.send("download-progress", { data, reason: reason });
};

// to process multiple beatmaps
export const parallel_map = async (array, mapper, concurrency) => {
    const results = [];

    let index = 0;
    let should_stop = false;

    const run = async () => {
        if (index >= array.length || should_stop) {
            return;
        }

        const current_index = index++;

        try {
            const result = await mapper(array[current_index], current_index, array);

            if (result?.stop) {
                should_stop = true;
                return;
            }

            results[current_index] = result;
        } catch (error) {
            console.log(`error processing item at index ${current_index}:`, error);
        }

        await run();
    };

    await Promise.all(
        Array(Math.min(concurrency, array.length))
            .fill()
            .map(() => run())
    );

    return results;
};

const main = (ipc_main, w) => {
    console.log("[downloader] initializing handlers");

    ipc_main.handle("add-download", (_, download) => add_download(download));
    ipc_main.handle("add-mirror", (_, mirror) => add_mirror(mirror));
    ipc_main.handle("set-token", (_, new_token) => set_token(new_token));
    ipc_main.handle("start-download", (_, name) => start_processing(name));
    ipc_main.handle("resume-download", (_, name) => resume_processing(name));
    ipc_main.handle("stop-download", (name) => stop_processing(name));
    ipc_main.handle("get-downloads", () => get_downloads());
    ipc_main.handle("remove-download", (_, name) => remove_download(name));
    ipc_main.handle("remove-mirror", (_, name) => remove_mirror(name));

    main_window = w;
};

const start_processing = async (name) => {
    // a single download already causes lots of rate limited stuff so lets just go with a single one
    if (processing) {
        return true;
    }

    const current_index = downloads.findIndex((c) => c.name == name);
    const current_download = downloads[current_index];

    if (!current_download) {
        current_download.finished = true;
        send_download_progress(current_download, "failed to get download (" + name + ")");
        console.log("[downloader] failed to get download:", name);
        return false;
    }

    if (!token) {
        current_download.paused = true;
        send_download_progress(current_download, "missing access token");
        console.log("[downloader] missing access token");
        return false;
    }

    if (config.mirrors.length == 0) {
        current_download.paused = true;
        send_download_progress(current_download, "please add at least one mirror");
        console.log("[downloader] no mirrors to use");
        return false;
    }

    console.log("processing new download", name);
    processing = true;
    current_download.processing = true;

    const result = await process_download(current_download);

    if (result.paused) {
        processing = false;
        current_download.paused = true;
        send_download_progress(current_download);
        return;
    }

    current_download.finished = true;
    send_download_progress(current_download);

    // get next index
    const next_index = current_index < downloads.length - 1 ? current_index + 1 : 0;

    // remove the current download
    downloads.splice(current_index, 1);
    processing = false;

    // process the next one
    if (processing) {
        start_processing(downloads[next_index]?.name);
    }
};

// @TODO: this sucks
const stop_processing = (name) => {
    processing = false;
    return true;
};

const resume_processing = (name) => {
    const download = downloads.find((d) => d.name == name);

    if (!download) {
        console.log("[downloader] failed to resume", name);
        return false;
    }

    start_processing(name);

    return true;
};

const process_download = async (download) => {
    const result = { success: false, paused: false, reason: "" };

    // ensure we have the beatmaps to download
    if (!download.beatmaps || download.beatmaps.length == 0) {
        result.reason = "failed to get beatmaps for " + download;
        return result;
    }

    await parallel_map(
        download.beatmaps,
        async (beatmap) => {
            // check if we removed or paused the current download
            if (!processing) {
                result.paused = true;
                result.success = true;
                return { stop: true };
            }

            // check if we removed the download from the queue
            if (!downloads.find((c) => c.name == download.name)) {
                result.success = true;
                return { stop: true };
            }

            const beatmap_result = await process_beatmap(beatmap);

            // beatmap failed to download
            if (!beatmap_result) {
                download.progress.failed++;
            }

            download.progress.index++;
            send_download_progress(download);

            return beatmap_result;
        },
        MAX_PARALLEL_DOWNLOADS
    );

    result.success = true;
    return result;
};

const process_beatmap = async (beatmap) => {
    const beatmap_data = await get_beatmap_info(beatmap.md5);

    if (!beatmap_data) {
        console.log(`failed to get beatmap info for ${beatmap.md5}`);
        return false;
    }

    const osz_stream = await get_osz(beatmap_data.id);

    if (!osz_stream) {
        console.log(`failed to download beatmap ${beatmap_data.id}`);
        return false;
    }

    const save_path = get_save_path();

    if (!save_path) {
        processing = false;
        return false;
    }

    const filename = `${beatmap_data.beatmapset_id}.osz`;
    const full_path = path.join(save_path, filename);

    await save_file(osz_stream, full_path);

    return true;
};

const get_beatmap_info = async (hash) => {
    // return cached beatmap data if possible
    if (beatmap_cache.has(hash)) {
        return beatmap_cache.get(hash);
    }

    try {
        const response = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        // valid response?
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        beatmap_cache.set(hash, data);

        return data;
    } catch (error) {
        console.log(`error fetching beatmap info: ${error.message}`);
        return null;
    }
};

const get_osz = async (beatmap_id) => {
    for (let i = 0; i < config.mirrors.length; i++) {
        const mirror = config.mirrors[i];

        // ignore if mirror is in a cooldown (rate limited)
        if (mirror.cooldown && mirror.cooldown > Date.now()) {
            continue;
        }

        // remove rate limit
        if (mirror.cooldown && mirror.cooldown <= Date.now()) {
            mirror.cooldown = null;
            console.log(`removed rate limit from ${mirror.name}`);
        }

        let url = mirror.url;

        // remove to preven double "/"
        if (url.endsWith("/")) {
            url = url.slice(0, -1);
        }

        try {
            const response = await fetch(`${url}/${beatmap_id}`);

            if (response.status == 429) {
                console.log(`added rate limit to ${mirror.name}`);
                mirror.cooldown = Date.now() + COOLDOWN_MINUTES * 60 * 1000;
                continue;
            }

            if (response.ok) {
                return await response.arrayBuffer();
            }
        } catch (error) {
            console.log(`error downloading from ${mirror.name}: ${error.message}`);
        }
    }

    return null;
};

const save_file = async (buffer, file_path) => {
    try {
        fs.mkdirSync(path.dirname(file_path), { recursive: true });
        fs.writeFileSync(file_path, Buffer.from(buffer));
    } catch (error) {
        console.log(`error while saving: ${error.message}`);
    }
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// @TODO: validate beatmaps before download
const add_download = (download) => {
    console.log("adding", download.name);

    // add extra shit
    if (!download?.progress) {
        download.progress = { index: 0, length: download.beatmaps.length, failed: 0 };
    }

    download.finished = false;
    downloads.push(download);

    if (!processing) {
        start_processing(download.name);
    }

    return true;
};

// @TODO: start next download if possible
const remove_download = (name) => {
    const index = downloads.findIndex((d) => d.name == name);
    if (index != -1) downloads.splice(index, 1);
    console.log("removing", name, index);
    return true;
};

const add_mirror = (mirror) => {
    if (!mirror.name || !mirror.url) {
        console.log("add_mirror: missing name/url");
        return;
    }
    insert_mirror.run(mirror.name, mirror.url);
    update_mirrors();
};

const remove_mirror = (name) => {
    delete_mirror.run(name);
    update_mirrors();
};

const set_token = (new_token) => {
    token = new_token;
};

const get_downloads = () => downloads;

const get_save_path = () => {
    return config.lazer_mode ? config.export_path : config.stable_songs_path;
};

export const downloader = {
    main,
    add_download,
    add_mirror,
    remove_download,
    remove_mirror,
    set_token,
    get_downloads,
    start_processing,
    stop_processing
};
