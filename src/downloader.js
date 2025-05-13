import fs from "fs";
import path from "path";
import os from "os";

import { create_logger } from "./logger.js";

let download_path = "";
let mirrors = [];
let is_processing = false;
let access_token = null;
let current_download = {
    id: null,
    name: "",
    progress: {
        index: 0,
        total: 0
    },
    items: []
};

const osu_stuff_path = () => {
    switch (process.platform) {
        case 'win32':
            return path.join(os.homedir(), 'AppData', 'Roaming', "osu-stuff");
        case 'linux':
            return path.join(os.homedir(), '.local', 'share', "osu-stuff");
        default:
            return "";
    }
}

const downloaded_maps = new Map();
const bad_status = [401, 403, 408, 410, 500, 503, 504, 429];
const concurrency = 3;
const download_queue = [];
const logger = create_logger({ name: "downloader", show_date: true, save_to_path: { path: osu_stuff_path() }});

console.log(osu_stuff_path());

const parallel_map = async (array, mapper, concurrency) => {

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
            logger.error(`error processing item at index ${current_index}:`, error);
        }
        
        await run();
    };

    await Promise.all(Array(Math.min(concurrency, array.length)).fill().map(() => run()));
    return results;
};

const search_map_id = async (hash) => {

    try {

        const response = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`, {
            headers: {
                "Authorization": "Bearer " + access_token
            }
        });
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        return { ...data, id: data.beatmapset_id };
    } catch (error) {
        logger.error("error searching map:", error);
        return null;
    }
};

const save_map_file = (map_path, buffer) => {
    try {
        fs.writeFileSync(map_path, Buffer.from(buffer));
        return true;
    } catch (error) {
        logger.error(`failed to save file ${map_path}:`, error);
        return false;
    }
};

const send_progress_update = (win, id) => {

    if (!id || !win || id != current_download.id) {
        return;
    }
    
    const completed = current_download.items.filter(item => item.processed).length;
    const total = current_download.items.length;
    
    win.webContents.send("progress-update", {
        id,
        current: completed,
        length: total,
        status: current_download.status || {}
    });
    
    current_download.progress = {
        index: completed,
        total
    };
};

const update_progress = (win, id, item_index, total, status) => {

    if (!id || !win || id != current_download.id) {
        return;
    }
    
    current_download.status = status;
    
    if (item_index >= 0 && item_index < current_download.items.length) {
        current_download.items[item_index] = {
            ...current_download.items[item_index],
            processed: true,
            success: status.success
        };
    }
    
    send_progress_update(win, id);
};

const try_mirror = async (mirror_url, map_id) => {

    try {

        // make sure we have a valid mirror url
        const response = await fetch(`${mirror_url?.endsWith('/') ? mirror_url : mirror_url + '/'}${map_id}`, { method: "GET" });
        
        if (response.status == 200) {
            const buffer = await response.arrayBuffer();
            return buffer.byteLength > 0 ? buffer : null;
        }


        if (bad_status.includes(response.status)) {
            return { error: "bad_status" };
        }

        return null;
    } catch (error) {
        logger.error(error);
        return null;
    }
};

const update_mirror = (used_url) => {
    const mirror_index = mirrors.findIndex((m) => m[1] == used_url);
    if (mirror_index != -1) {
        const [ mirror ] = mirrors.splice(mirror_index, 1);
        mirrors.push(mirror);
    }
};

const get_buffer = async (map_id) => {

    for (const [name, url] of mirrors) {

        const result = await try_mirror(url, map_id);
        
        if (result?.error == "bad_status") {
            logger.debug("chaging", name, "mirror position (bad status)");
            update_mirror(url);
            continue;
        }
        
        if (result) {
            return result;
        }
    }

    return null;
};

const process_map = async (win, map, index, options) => {

    const { id, total } = options;
    const item_index = index - 1;
    
    if (id != current_download.id) {
        return { stop: true };
    }

    try {

        const map_data = map.id ? { hash: map.checksum, beatmapset_id: map.id } : await search_map_id(map.checksum);
        
        if (!map_data) {
            update_progress(win, id, index, total, { hash: map.checksum, success: false });
            return null;
        }

        const map_path = path.resolve(download_path, `${map_data.beatmapset_id}.osz`);

        if (fs.existsSync(map_path)) {
            logger.debug("ignoring", map.checksum, "(already downloaded)");
            update_progress(win, id, index, total, { hash: map.checksum, success: true });
            return null;
        }

        const map_buffer = await get_buffer(map_data.beatmapset_id);

        if (!map_buffer) {
            logger.error("failed to get buffer", map_data);
            update_progress(win, id, index, total, { hash: map.checksum, success: false });
            return null;
        }

        const saved = save_map_file(map_path, map_buffer);
        
        if (saved) {
            downloaded_maps.set(map_data.beatmapset_id, { 
                ...map_data, 
                checksum: map.checksum, 
                md5: map.checksum 
            });
        }

        if (id != current_download.id) {
            logger.error("stoping download (download id does not match)");
            return { stop: true };
        }    

        update_progress(win, id, item_index, total, { hash: map.checksum, success: saved });
        return map_data;
    } catch (error) {
        logger.error("download failed:", error);
        update_progress(win, id, index, total, { hash: map.checksum, success: false });
        return null;
    }
};

const process_queue = async (win) => {

    if (download_queue.length == 0) {
        logger.debug("finished all queue items");
        is_processing = false;
        return;
    }

    const { maps, id, name } = download_queue.shift();

    logger.debug("starting download", id);
    logger.debug("using mirrors", mirrors);
    
    is_processing = true;
    current_download.id = id;
    current_download.name = name;
    current_download.progress = {
        index: 0,
        total: maps.length
    };
    
    current_download.items = maps.map((hash, index) => ({
        hash,
        index,
        processed: false,
        success: false
    }));

    win.webContents.send("download-create", { id, name });
    
    await parallel_map(maps, (map, index) => process_map(win, map, index + 1, { id, total: maps.length }), concurrency);
    
    if (current_download.id == id) {
        win.webContents.send("progress-end", { id, name, success: true });
        
        current_download.id = null;
        current_download.name = "";
        current_download.items = [];
    }
    
    process_queue(win);
};

async function download_single_map(hash) {

    try {
        
        const map_data = await search_map_id(hash);
        
        if (!map_data) {
            logger.error("not found", hash);
            return { success: false };
        }

        const map_path = path.resolve(download_path, `${map_data.beatmapset_id}.osz`);

        if (fs.existsSync(map_path)) {
            logger.debug("ignoring", hash, "(already downloaded)");
            return { success: true, data: map_data };
        }

        const map_buffer = await get_buffer(map_data.beatmapset_id);

        if (!map_buffer) {
            logger.error("failed to get buffer", hash);
            return { success: false };
        }

        save_map_file(map_path, map_buffer);

        downloaded_maps.set(map_data.beatmapset_id, { 
            ...map_data, 
            checksum: hash, 
            md5: hash 
        });
        
        return { success: true, data: map_data };
    
    } catch (error) {
        return { success: false, reason: "error", error: error.message };
    }
};

export const init_downloader = (window, ipcMain) => {

    current_download.id = null;
    current_download.name = "";
    current_download.items = [];
    current_download.progress.index = 0;
    current_download.progress.total = 0;

    ipcMain.handle("update-token", (_, token) => {
        access_token = token;
        return true;
    });

    ipcMain.handle("update-mirrors", (_, mirror_list) => {
        mirrors = mirror_list;
        return true;
    });

    ipcMain.handle("update-path", (_, new_path) => {

        download_path = new_path;
        
        try {
            if (!fs.existsSync(download_path)) {
                fs.mkdirSync(download_path, { recursive: true });
            }
            return true;
        } catch (error) {
            logger.error("error updating download path:", error);
            return false;
        }
    });

    ipcMain.handle("is-downloading", (_) => {
        return current_download.id != null;
    });

    ipcMain.handle("get-queue", (_) => {
        return [ current_download, ...download_queue ];
    });

    ipcMain.handle("create-download", (_, data) => {

        if (!data?.id) {
            logger.error("create download data.id is null", data);
            return false;
        }

        if (!data?.maps || data?.maps.length == 0) {
            logger.error("create download data.maps is null", data);
            return false;
        }
        
        download_queue.push({ maps: data.maps, id: data.id, name: data?.name || "download task" });
        
        if (!is_processing) {
            process_queue(window);
        }
        
        return true;
    });

    ipcMain.handle("stop-download", (_, id) => {

        const queue_index = download_queue.findIndex(item => item.id == id);

        if (queue_index != -1) {
            download_queue.splice(queue_index, 1);
            return true;
        }

        if (current_download.id == id) {

            current_download.id = null;
            window.webContents.send("progress-end", { id: id, name: current_download.name, success: false });
            
            setTimeout(() => {
                process_queue(window);
            }, 100);
            
            return true;
        }
        
        return false;
    });

    ipcMain.handle("single-map", async (_, hash) => {
        return await download_single_map(hash);
    });
};
