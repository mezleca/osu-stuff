import fs from "fs";
import path from "path";
import os from "os";

import { create_logger } from "./logger.js";

const osu_stuff_path = () => {
    switch (process.platform) {
        case 'win32':
            return path.join(os.homedir(), 'AppData', 'Roaming', "osu-stuff");
        case 'linux':
            return path.join(os.homedir(), '.local', 'share', "osu-stuff");
        default:
            return "";
    }
};

const downloader = {
    current: {
        id: null,
        name: "",
        progress: { index: 0, total: 0 },
        items: []
    },
    queue: [],
    finished: new Map()
};

const bad_status = [401, 403, 408, 410, 500, 503, 504, 429];
const concurrency = 3;
const logger = create_logger({ name: "downloader", show_date: true, save_to_path: { path: osu_stuff_path() }});

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
                "Authorization": "Bearer " + downloader.access_token
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

    if (!id || !win || id != downloader.current.id) {
        return;
    }
    
    const completed = downloader.current.items.filter(item => item.processed).length;
    const total = downloader.current.items.length;
    
    win.webContents.send("progress-update", {
        id,
        current: completed,
        length: total,
        status: downloader.current.status || {}
    });
    
    downloader.current.progress = {
        index: completed,
        total
    };
};

const update_progress = (win, id, item_index, total, status) => {

    if (!id || !win || id != downloader.current.id) {
        return;
    }
    
    downloader.current.status = status;
    
    if (item_index >= 0 && item_index < downloader.current.items.length) {
        downloader.current.items[item_index] = {
            ...downloader.current.items[item_index],
            processed: true,
            success: status.success
        };
    }
    
    send_progress_update(win, id);
};

const try_mirror = async (mirror_url, map_id) => {

    try {

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
    const mirror_index = downloader.mirrors.findIndex((m) => m[1] == used_url);
    if (mirror_index != -1) {
        const [ mirror ] = downloader.mirrors.splice(mirror_index, 1);
        downloader.mirrors.push(mirror);
    }
};

const get_buffer = async (map_id) => {

    for (const [name, url] of downloader.mirrors) {

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
    
    if (id != downloader.current.id) {
        return { stop: true };
    }

    try {

        const map_data = map.id ? { hash: map.md5, beatmapset_id: map.id } : await search_map_id(map.md5);
        
        if (!map_data) {
            logger.error("map not found", map, map_data);
            update_progress(win, id, index, total, { hash: map.md5, success: false });
            return null;
        }

        const map_path = path.resolve(downloader.download_path, `${map_data.beatmapset_id}.osz`);

        if (fs.existsSync(map_path)) {
            logger.debug("ignoring", map.md5, "(already downloaded)");
            update_progress(win, id, index, total, { hash: map.md5, success: true });
            return null;
        }

        const map_buffer = await get_buffer(map_data.beatmapset_id);

        if (!map_buffer) {
            logger.error("failed to get buffer", map_data);
            update_progress(win, id, index, total, { hash: map.md5, success: false });
            return null;
        }

        const saved = save_map_file(map_path, map_buffer);
        
        if (saved) {
            downloader.finished.set(map_data.beatmapset_id, { 
                ...map_data, 
                md5: map.md5
            });
        }

        if (id != downloader.current.id) {
            logger.error("stoping download (download id does not match)");
            return { stop: true };
        }    

        update_progress(win, id, item_index, total, { hash: map.md5, success: saved });
        return map_data;
    } catch (error) {
        logger.error("download failed:", error);
        update_progress(win, id, index, total, { hash: map.md5, success: false });
        return null;
    }
};

const process_queue = async (win) => {

    if (!downloader?.mirrors || !downloader?.access_token) {
        logger.error("missing mirror / access_token", downloader);
        return;
    }

    if (downloader.queue.length == 0) {
        logger.debug("finished all queue items");
        downloader.is_processing = false;
        return;
    }

    const { maps, id, name } = downloader.queue.shift();

    logger.debug("starting download", id);
    logger.debug("using mirrors", downloader.mirrors);
    
    downloader.is_processing = true;
    downloader.current.id = id;
    downloader.current.name = name;
    downloader.current.progress = {
        index: 0,
        total: maps.length
    };
    
    downloader.current.items = maps.map((hash, index) => ({
        hash,
        index,
        processed: false,
        success: false
    }));

    win.webContents.send("download-create", { id, name });
    
    await parallel_map(maps, (map, index) => process_map(win, map, index + 1, { id, total: maps.length }), concurrency);
    
    if (downloader.current.id == id) {

        downloader.current.id = null;
        downloader.current.name = "";
        downloader.current.items = [];

        win.webContents.send("progress-end", { id, name, success: true });    
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

        const map_path = path.resolve(downloader.download_path, `${map_data.beatmapset_id}.osz`);

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

        downloader.finished.set(map_data.beatmapset_id, { 
            ...map_data,
            md5: hash 
        });
        
        return { success: true, data: map_data };
    
    } catch (error) {
        return { success: false, reason: "error", error: error.message };
    }
};

export const init_downloader = (window, ipcMain) => {

    downloader.current.id = null;
    downloader.current.name = "";
    downloader.current.items = [];
    downloader.current.progress.index = 0;
    downloader.current.progress.total = 0;

    ipcMain.handle("update-token", (_, token) => {
        downloader.access_token = token;
        return true;
    });

    ipcMain.handle("update-mirrors", (_, mirror_list) => {
        downloader.mirrors = mirror_list;
        return true;
    });

    ipcMain.handle("update-path", (_, new_path) => {

        downloader.download_path = new_path;
        
        try {
            if (!fs.existsSync(downloader.download_path)) {
                fs.mkdirSync(downloader.download_path, { recursive: true });
            }
            return true;
        } catch (error) {
            logger.error("error updating download path:", error);
            return false;
        }
    });

    ipcMain.handle("is-downloading", (_) => downloader.current.id != null);
    ipcMain.handle("get-queue", (_) => [downloader.current, ...downloader.queue]);

    ipcMain.handle("create-download", (_, data) => {

        if (!data?.id) {
            logger.error("create download data.id is null", data);
            return false;
        }

        if (!data?.maps || data?.maps.length == 0) {
            logger.error("create download data.maps is null", data);
            return false;
        }

        downloader.queue.push({ maps: data.maps, id: data.id, name: data?.name || "download task" });
        
        if (!downloader.is_processing) {
            process_queue(window);
        }
        
        return true;
    });

    ipcMain.handle("stop-download", (_, id) => {

        const queue_index = downloader.queue.findIndex(item => item.id == id);

        if (queue_index != -1) {
            downloader.queue.splice(queue_index, 1);
            return true;
        }

        if (downloader.current.id == id) {

            downloader.current.id = null;
            window.webContents.send("progress-end", { id: id, name: downloader.current.name, success: false });
            
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
