import { config } from "../database/config";
import { delete_mirror, insert_mirror, update_mirrors } from "../database/mirrors";

import fs from "fs";
import path from "path";

let token = "";
let main_window = null;
let current_download = null;

const downloads = [];
const beatmap_cache = new Map();
const MAX_PARALLEL_DOWNLOADS = 3;
const COOLDOWN_MINUTES = 5;

// send updated list
const send_downloads_update = (reason = "") => {
    main_window.webContents.send("downloads-update", {
        downloads: downloads.map((d) => ({ ...d })),
        reason
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
    console.log("[downloader] initializing handlers");

    ipc_main.handle("add-download", (_, download) => add_download(download));
    ipc_main.handle("single-download", (_, beatmap) => single_download(beatmap));
    ipc_main.handle("add-mirror", (_, mirror) => add_mirror(mirror));
    ipc_main.handle("set-token", (_, new_token) => set_token(new_token));
    ipc_main.handle("start-download", (_, name) => start_processing(name));
    ipc_main.handle("resume-download", (_, name) => resume_processing(name));
    ipc_main.handle("stop-download", (_, name) => stop_processing(name));
    ipc_main.handle("get-downloads", () => downloads.map((d) => ({ ...d })));
    ipc_main.handle("remove-download", (_, name) => remove_download(name));
    ipc_main.handle("remove-mirror", (_, name) => remove_mirror(name));

    main_window = w;
};

const start_processing = async (name) => {
    // a single download already causes lots of rate limited stuff so lets just go with a single one
    if (current_download) {
        console.log("[downloader] another download is already processing:", current_download.name);
        return false;
    }

    const download = downloads.find((d) => d.name == name);

    if (!download) {
        console.log("[downloader] failed to get download:", name);
        return false;
    }

    if (!token) {
        download.paused = true;
        send_downloads_update("missing access token");
        console.log("[downloader] missing access token");
        return false;
    }

    if (config.mirrors.length == 0) {
        download.paused = true;
        send_downloads_update("please add at least one mirror");
        console.log("[downloader] no mirrors to use");
        return false;
    }

    console.log("[downloader] processing download:", name);

    // set current download
    current_download = download;
    download.processing = true;
    download.paused = false;
    download.stopped = false;

    send_downloads_update();

    const result = await process_download(download);

    // cleanup
    current_download = null;
    download.processing = false;

    if (result.stopped) {
        download.paused = true;
        send_downloads_update("download paused");
        return true;
    }

    // cleanup
    if (result.success) {
        download.finished = true;
        send_downloads_update();

        // remove finished download
        const index = downloads.findIndex((d) => d.name == name);

        if (index != -1) {
            downloads.splice(index, 1);
        }

        // start next queued download
        const next_download = downloads.find((d) => !d.processing && !d.paused && !d.finished);

        if (next_download) {
            setTimeout(() => start_processing(next_download.name), 100);
        }

        send_downloads_update();
    }

    return true;
};

const stop_processing = (name) => {
    const download = downloads.find((d) => d.name == name);

    if (!download) {
        console.log("[downloader] download not found:", name);
        return false;
    }

    // if this download is currently processing, stop it
    if (current_download && current_download.name == name) {
        current_download.stopped = true;
        console.log(`[downloader] stopping current download: ${name}`);
    }

    download.paused = true;
    download.processing = false;

    return true;
};

const resume_processing = async (name) => {
    const download = downloads.find((d) => d.name == name);

    if (!download) {
        console.log("[downloader] failed to resume", name);
        return false;
    }

    // check if another download is processing
    if (current_download && current_download.name != name) {
        console.log(`[downloader] pausing current download ${current_download.name} to start ${name}`);
        stop_processing(current_download.name);

        // wait a bit until it stops
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    download.paused = false;
    start_processing(name);
    return true;
};

const process_download = async (download) => {
    const result = { success: false, stopped: false, reason: "" };

    // ensure we have beatmaps to download
    if (!download.beatmaps || download.beatmaps.length == 0) {
        result.reason = "failed to get beatmaps for " + download.name;
        return result;
    }

    await parallel_map(
        download.beatmaps,
        async (beatmap) => {
            // check if download was stopped
            if (download.stopped) {
                result.stopped = true;
                return { stop: true };
            }

            // check if download was removed
            if (!downloads.find((d) => d.name == download.name)) {
                result.success = true;
                return { stop: true };
            }

            const beatmap_result = await process_beatmap(beatmap);

            // update progress
            if (!beatmap_result) {
                download.progress.failed++;
            }

            download.progress.index++;
            send_downloads_update();

            return beatmap_result;
        },
        MAX_PARALLEL_DOWNLOADS
    );

    if (download.stopped) {
        result.stopped = true;
    } else {
        result.success = true;
    }

    return result;
};

const process_beatmap = async (beatmap) => {
    const save_path = get_save_path();
    const beatmap_data = await get_beatmap_info(beatmap);

    if (!beatmap_data) {
        console.log(`failed to get beatmap info for ${beatmap.md5 ?? beatmap.beatmapset_id}`);
        return false;
    }

    const id = String(beatmap_data.beatmapset_id);

    // check if we alredy have a folder with the same id or the file itself
    if ((fs.existsSync(path.resolve(save_path, id)), fs.existsSync(path.resolve(save_path, `${id}.osz`)))) {
        console.log("[downloader] file already exists");
        return beatmap_data;
    }

    const osz_stream = await get_osz(id);

    if (!osz_stream) {
        console.log(`failed to download beatmap ${id}`);
        return false;
    }

    const filename = `${id}.osz`;
    const full_path = path.join(save_path, filename);

    await save_file(osz_stream, full_path);
    return beatmap_data;
};

const get_beatmap_info = async (beatmap) => {
    if (beatmap.beatmapset_id) {
        return beatmap;
    }

    const hash = beatmap.md5;

    // dont even bother
    if (!hash) {
        return null;
    }

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

const single_download = async (beatmap) => {
    const result = await process_beatmap(beatmap);
    return result;
};

const add_download = (download) => {
    // setup download object
    if (!download?.progress) {
        download.progress = {
            index: 0,
            length: download.beatmaps.length,
            failed: 0
        };
    }

    // ensure properties are being set
    download.finished = false;
    download.processing = false;
    download.paused = false;
    download.stopped = false;

    // pause
    download.paused = current_download ? true : false;

    downloads.push(download);

    // start processing if theres no active download
    if (!current_download) {
        setTimeout(() => start_processing(download.name), 100);
    }

    send_downloads_update();
    return true;
};

const remove_download = (name) => {
    // stop if this download is currently processing
    if (current_download && current_download.name == name) {
        stop_processing(name);
    }

    const index = downloads.findIndex((d) => d.name == name);

    if (index != -1) {
        downloads.splice(index, 1);
        console.log("removing", name, index);

        // start processing if theres no active download
        setTimeout(() => {
            if (!current_download) {
                const next_download = downloads.find((d) => !d.processing && !d.paused && !d.finished);
                if (next_download) {
                    start_processing(next_download.name);
                }
            }
        }, 100);
    }

    send_downloads_update();
    return true;
};

const add_mirror = (mirror) => {
    if (!mirror.name || !mirror.url) {
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

const get_save_path = () => {
    return config.lazer_mode ? config.export_path : config.stable_songs_path;
};

const exportBeatmaps = async (beatmaps) => {
    const result = { success: false, written: [], reason: "" };

    if (!beatmaps || !Array.isArray(beatmaps) || beatmaps.length == 0) {
        result.reason = "invalid beatmaps list";
        return result;
    }

    // ensure export path exists
    const export_path = config.export_path;

    try {
        if (!export_path || !fs.existsSync(export_path)) {
            fs.mkdirSync(export_path, { recursive: true });
        }
    } catch (err) {
        result.reason = `failed to create export path: ${err.message}`;
        return result;
    }

    for (const b of beatmaps) {
        try {
            const info = await get_beatmap_info(b);

            if (!info) {
                console.log(`[export] failed to get beatmap info for ${b.md5 ?? b.beatmapset_id}`);
                continue;
            }

            const id = String(info.beatmapset_id);
            const osz_stream = await get_osz(id);

            if (!osz_stream) {
                console.log(`[export] failed to fetch osz for ${id}`);
                continue;
            }

            const filename = `${id}.osz`;
            const full_path = path.join(export_path, filename);
            await save_file(osz_stream, full_path);
            result.written.push(full_path);
        } catch (err) {
            console.log(`[export] error exporting beatmap: ${err.message}`);
        }
    }

    result.success = result.written.length > 0;
    if (!result.success) result.reason = "no files were exported";
    return result;
};

const emit_export_update = (data) => {
    try {
        if (main_window) main_window.webContents.send("export-update", data);
    } catch (err) {
        console.log("failed to emit export update", err.message);
    }
};

const exportSingleBeatmap = async (beatmap) => {
    const result = { success: false, written: [], reason: "" };

    if (!beatmap) {
        result.reason = "invalid beatmap";
        return result;
    }

    try {
        emit_export_update({ md5: beatmap.md5 || null, status: "start" });

        const info = await get_beatmap_info(beatmap);

        if (!info) {
            emit_export_update({ md5: beatmap.md5 || null, status: "error", reason: "failed to resolve beatmap" });
            result.reason = "failed to resolve beatmap";
            return result;
        }

        const id = String(info.beatmapset_id);
        emit_export_update({ md5: info.checksum || info.md5 || null, status: "fetching", id });

        const osz_stream = await get_osz(id);

        if (!osz_stream) {
            emit_export_update({ md5: info.checksum || info.md5 || null, status: "error", reason: "failed to fetch osz" });
            result.reason = "failed to fetch osz";
            return result;
        }

        const export_path = config.export_path;

        if (!export_path) {
            result.reason = "invalid export path";
            emit_export_update({ md5: info.checksum || info.md5 || null, status: "error", reason: result.reason });
            return result;
        }

        const filename = `${id}.osz`;
        const full_path = path.join(export_path, filename);

        emit_export_update({ md5: info.checksum || info.md5 || null, status: "saving", path: full_path });

        await save_file(osz_stream, full_path);

        emit_export_update({ md5: info.checksum || info.md5 || null, status: "done", path: full_path });

        result.success = true;
        result.written.push(full_path);
        return result;
    } catch (err) {
        console.log(`exportSingleBeatmap error: ${err.message}`);
        emit_export_update({ md5: beatmap.md5 || null, status: "error", reason: err.message });
        result.reason = err.message;
        return result;
    }
};

export const downloader = {
    main,
    add_download,
    add_mirror,
    remove_download,
    remove_mirror,
    set_token,
    start_processing,
    stop_processing
    ,
    exportBeatmaps,
    exportSingleBeatmap
};
