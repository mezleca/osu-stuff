import { config } from "../database/config";

import fs from "fs";
import path from "path";
import { delete_mirror, insert_mirror, update_mirrors } from "../database/mirrors";

let token = "";
let processing = false;
let main_window = null;

const downloads = new Map();
const beatmap_cache = new Map();
const MAX_PARALLEL_DOWNLOADS = 3;
const COOLDOWN_MINUTES = 5;

export const send_download_progress = (data) => {
    console.log("sending progress", data.name, data.progress.index);
    main_window.webContents.send("download-progress", {
        name: data.name,
        index: data.progress.index,
        length: data.progress.length,
        failed: data.progress.failed,
        finished: data.finished
    });
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
    console.log("initializing downloader handlers");

    ipc_main.handle("add-download", (_, download) => add_download(download));
    ipc_main.handle("add-mirror", (_, mirror) => add_mirror(mirror));
    ipc_main.handle("set-token", (_, new_token) => set_token(new_token));
    ipc_main.handle("start-download", (_, name) => start_processing(name));
    ipc_main.handle("stop-download", () => stop_processing());
    ipc_main.handle("get-downloads", () => get_downloads());
    ipc_main.handle("remove-download", (_, name) => remove_download(name));
    ipc_main.handle("remove-mirror", (_, name) => remove_mirror(name));

    main_window = w;
};

const start_processing = async (name) => {
    if (processing) {
        return;
    }

    processing = true;

    while (processing && downloads.size > 0) {
        // make sure we have a token
        if (!token) {
            break;
        }

        if (config.mirrors.length == 0) {
            console.log("mirrors is equal to 0");
            // @TODO: tell something to the frontend
            break;
        }

        await process_download(downloads.get(name));

        // go to the next one
        if (processing) {
            downloads.delete(name);
        }

        console.log("processing new download");
    }

    processing = false;
};

const stop_processing = () => {
    processing = false;
};

const process_download = async (download) => {
    // ensure we have the beatmaps to download
    if (!download.beatmaps || download.beatmaps.length == 0) {
        console.log("failed to get beatmaps for", download);
        return;
    }

    await parallel_map(
        download.beatmaps,
        async (beatmap) => {
            if (!processing || !downloads.has(download.name)) {
                return { stop: true };
            }

            const success = await process_beatmap(download, beatmap);

            if (!success) {
                download.progress.failed++;
            }

            download.progress.index++;
            send_download_progress(download);

            return success;
        },
        MAX_PARALLEL_DOWNLOADS
    );
};

const process_beatmap = async (download, beatmap) => {
    // check if we're still downloading
    if (!processing || !downloads.has(download.name)) {
        console.log("download not found", download);
        return { stop: true };
    }

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
        console.log(`Error saving file: ${error.message}`);
    }
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const add_download = (download) => {
    downloads.set(download.name, download);
};

const remove_download = (name) => {
    downloads.delete(name);
};

const add_mirror = (mirror) => {
    console.log("add_mirror:", mirror);
    if (!mirror.name || !mirror.url) {
        console.log("add_mirror: missing name/url");
        return;
    }
    insert_mirror.run(mirror.name, mirror.url);
    update_mirrors();
};

const remove_mirror = (name) => {
    console.log("remove_mirror:", name);
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
