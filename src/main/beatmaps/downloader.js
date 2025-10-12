import { config } from "../database/config";
import { delete_mirror, get_mirrors, insert_mirror, update_mirrors } from "../database/mirrors";
import { get_lazer_file_location } from "../reader/realm.js";
import { get_and_update_collections } from "./collections.js";
import { get_beatmap_by_md5 } from "./beatmaps.js";

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

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

    const mirrors = get_mirrors();

    console.log("mirrors:", mirrors);

    if (!mirrors || mirrors?.length == 0) {
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
    const mirrors = get_mirrors();

    for (let i = 0; i < mirrors.length; i++) {
        const mirror = mirrors[i];

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
            const osz_url = `${url}/${beatmap_id}`;
            const response = await fetch(osz_url);

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

    return insert_mirror(mirror.name, mirror.url);
};

const remove_mirror = (name) => {
    return delete_mirror(name);
};

const set_token = (new_token) => {
    token = new_token;
};

const get_save_path = () => {
    return config.lazer_mode ? config.export_path : config.stable_songs_path;
};

const get_beatmap_files = async (beatmap_data) => {
    const files = [];

    if (!config.lazer_mode) {
        const stable_files = get_stable_beatmap_files(beatmap_data);
        files.push(...stable_files);
    } else {
        const lazer_files = get_lazer_beatmap_files(beatmap_data);
        files.push(...lazer_files);
    }

    return files;
};

const get_stable_beatmap_files = (beatmap_data) => {
    const folder = beatmap_data.folder_name || (beatmap_data.file_path ? beatmap_data.file_path.split("/")[0] : null);

    if (!folder) {
        throw new Error("failed to determine folder for stable beatmap");
    }

    const folder_path = path.resolve(config.stable_songs_path, folder);

    if (!fs.existsSync(folder_path)) {
        throw new Error(`folder not found: ${folder_path}`);
    }

    return get_dir_files(folder_path, "");
};

const get_lazer_beatmap_files = (beatmap_data) => {
    const set = beatmap_data.beatmapset;
    const files = [];

    if (!set?.Files?.length) {
        throw new Error("missing beatmapset file info for lazer");
    }

    for (const f of set.Files) {
        const filename = f.Filename || f.filename || f.name;
        const hash = (f.File && f.File.Hash) || f.Hash || f.file;

        if (!filename || !hash) {
            continue;
        }

        const file_location = get_lazer_file_location(hash);

        if (!audio_location || !fs.existsSync(audio_location)) {
            console.log(`[export] missing lazer file ${file_location}`);
            continue;
        }

        files.push({
            source_path: file_location,
            zip_path: filename
        });
    }

    return files;
};

const get_dir_files = (base_path, rel_base) => {
    const files = [];
    const dir_files = fs.readdirSync(base_path, { withFileTypes: true });

    for (const f of dir_files) {
        const full_path = path.join(base_path, f.name);
        const rel_path = path.join(rel_base, f.name);

        if (f.isDirectory()) {
            const sub_files = get_dir_files(full_path, rel_path);
            files.push(...sub_files);
        } else if (f.isFile()) {
            files.push({
                source_path: full_path,
                zip_path: rel_path
            });
        }
    }

    return files;
};

const create_zip_from_files = (files, target_path) => {
    try {
        const zip = new AdmZip();

        for (const file of files) {
            try {
                const dir_path = path.dirname(file.zip_path);
                const file_name = path.basename(file.zip_path);

                zip.addLocalFile(file.source_path, dir_path == "." ? "" : dir_path, file_name);
            } catch (e) {
                console.log(`failed to add file ${file.source_path}: ${e.message}`);
            }
        }

        zip.writeZip(target_path);
        return true;
    } catch (error) {
        console.log(`failed to create zip: ${error.message}`);
        return false;
    }
};

const export_beatmap_to_path = async (beatmap_data, target_path) => {
    if (fs.existsSync(target_path)) {
        return { success: true, path: target_path, skipped: true };
    }

    try {
        const files = await get_beatmap_files(beatmap_data);

        if (files.length == 0) {
            throw new Error("no files found to export");
        }

        const success = create_zip_from_files(files, target_path);

        if (!success) {
            throw new Error("failed to create zip file");
        }

        return { success: true, path: target_path, skipped: false };
    } catch (error) {
        console.log(`failed to export beatmap: ${error.message}`);
        throw error;
    }
};

const ensure_directory = (dir_path) => {
    try {
        if (!fs.existsSync(dir_path)) {
            fs.mkdirSync(dir_path, { recursive: true });
        }
        return true;
    } catch (err) {
        console.log(`failed to create directory ${dir_path}: ${err.message}`);
        return false;
    }
};

const emit_export_update = (data) => {
    try {
        if (main_window) main_window.webContents.send("export-update", data);
    } catch (err) {
        console.log("failed to emit export update", err.message);
    }
};

// export single beatmap
const export_single_beatmap = async (beatmap) => {
    if (!beatmap) {
        return { success: false, written: [], reason: "invalid beatmap" };
    }

    try {
        const md5 = beatmap.md5 || null;
        emit_export_update({ md5, status: "start" });

        if (!config.export_path) {
            const reason = "no export path configured";
            emit_export_update({ md5, status: "error", reason });
            return { success: false, written: [], reason };
        }

        if (!ensure_directory(config.export_path)) {
            const reason = "failed to create export directory";
            emit_export_update({ md5, status: "error", reason });
            return { success: false, written: [], reason };
        }

        const id = beatmap.beatmapset_id || beatmap.difficulty_id || beatmap.md5 || Date.now();
        const filename = `${id}.osz`;
        const target_path = path.join(config.export_path, filename);

        const export_result = await export_beatmap_to_path(beatmap, target_path);

        const status = export_result.skipped ? "exists" : "done";
        emit_export_update({ md5, status, path: export_result.path });

        return {
            success: true,
            written: [export_result.path],
            reason: ""
        };
    } catch (err) {
        console.log(`export_single_beatmap error: ${err.message}`);
        const reason = err.message;
        emit_export_update({ md5: beatmap.md5 || null, status: "error", reason });
        return { success: false, written: [], reason };
    }
};

const find_collection = (collections, collection_name) => {
    // handle map type collections
    if (collections instanceof Map) {
        return collections.get(collection_name);
    }

    // handle array type collections
    if (Array.isArray(collections)) {
        return collections.find((c) => c.name == collection_name);
    }

    // handle object type collections
    if (collections && typeof collections == "object") {
        if (collections[collection_name]) {
            return collections[collection_name];
        }

        // fallback to searching in values
        return Object.values(collections).find((c) => c?.name == collection_name);
    }

    return null;
};

const export_beatmaps = async (collection_names) => {
    if (!Array.isArray(collection_names) || collection_names.length == 0) {
        const reason = "invalid collections payload";
        emit_export_update({ status: "error", reason });
        return { success: false, written: [], reason };
    }

    try {
        const collection_data = await get_and_update_collections();

        if (!collection_data?.collections) {
            const reason = "failed to read local collections";
            emit_export_update({ status: "error", reason });
            return { success: false, written: [], reason };
        }

        if (!config.export_path || !ensure_directory(config.export_path)) {
            const reason = "export path not configured or failed to create";
            emit_export_update({ status: "error", reason });
            return { success: false, written: [], reason };
        }

        const exported_cache = new Map();
        const written_files = [];

        // process each collection
        for (const collection_name of collection_names) {
            try {
                const collection = find_collection(collection_data.collections, collection_name);

                if (!collection) {
                    console.log(`[export] collection not found: ${collection_name}`);
                    continue;
                }

                if (!Array.isArray(collection.maps) || collection.maps.length == 0) {
                    continue;
                }

                const exported_files = await export_collection(collection_name, collection.maps, config.export_path, exported_cache);

                written_files.push(...exported_files);
            } catch (error) {
                console.log(`[export] failed to process collection ${collection_name}: ${error.message}`);
            }
        }

        const success = written_files.length > 0;

        if (success) {
            console.log(`[export] batch finished, exported ${written_files.length} files`);
            emit_export_update({ status: "complete", written: written_files.length });
        } else {
            const reason = "no files were exported";
            console.log(`[export] batch finished with zero exports`);
            emit_export_update({ status: "error", reason });
        }

        return { success, written: written_files, reason: success ? "" : "no files were exported" };
    } catch (error) {
        const reason = `export failed: ${error.message}`;
        emit_export_update({ status: "error", reason });
        return { success: false, written: [], reason };
    }
};

// export specific collection to folder
const export_collection = async (collection_name, md5_list, export_path, exported_cache) => {
    const safe_name = collection_name.replace(/[\\/:*?"<>|]/g, "_");
    const collection_folder = path.join(export_path, safe_name);

    if (!ensure_directory(collection_folder)) {
        throw new Error(`failed to create collection folder: ${collection_folder}`);
    }

    emit_export_update({
        status: "start",
        collection: collection_name,
        total: md5_list.length
    });

    const exported_files = [];

    for (const md5 of md5_list) {
        try {
            const beatmap_data = await get_beatmap_by_md5(md5);

            if (!beatmap_data?.beatmapset_id) {
                emit_export_update({ status: "missing", collection: collection_name, md5 });
                continue;
            }

            const id = String(beatmap_data.beatmapset_id);
            const target_path = path.join(collection_folder, `${id}.osz`);

            // check deduplication cache
            if (exported_cache.has(id)) {
                await handle_cached_beatmap(id, target_path, exported_cache, collection_name);
            } else {
                await handle_new_beatmap(beatmap_data, id, target_path, exported_cache, collection_name);
            }

            exported_files.push(target_path);
        } catch (error) {
            console.log(`[export] error processing beatmap ${md5}: ${error.message}`);
            emit_export_update({ status: "missing", collection: collection_name, md5 });
        }
    }

    return exported_files;
};

// handle already cached beatmap files
const handle_cached_beatmap = async (id, target_path, exported_cache, collection_name) => {
    if (fs.existsSync(target_path)) {
        emit_export_update({
            beatmapset_id: id,
            collection: collection_name,
            status: "exists",
            path: target_path
        });
        return;
    }

    const existing_path = exported_cache.get(id);

    try {
        // try hard link first, fallback to copy
        try {
            fs.linkSync(existing_path, target_path);
        } catch (link_err) {
            fs.copyFileSync(existing_path, target_path);
        }

        emit_export_update({
            beatmapset_id: id,
            collection: collection_name,
            status: "linked",
            path: target_path
        });
    } catch (e) {
        console.log(`[export] failed to link/copy for ${id}: ${e.message}`);
        throw e; // re-throw for handling
    }
};

// handle new beatmap files (not in cache)
const handle_new_beatmap = async (beatmap_data, id, target_path, exported_cache, collection_name) => {
    const export_result = await export_beatmap_to_path(beatmap_data, target_path);
    exported_cache.set(id, target_path);

    const status = export_result.skipped ? "exists" : "done";

    emit_export_update({
        beatmapset_id: id,
        collection: collection_name,
        status,
        path: target_path
    });
};

export const downloader = {
    main,
    add_download,
    add_mirror,
    remove_download,
    remove_mirror,
    set_token,
    start_processing,
    stop_processing,
    export_beatmaps,
    export_single_beatmap
};
