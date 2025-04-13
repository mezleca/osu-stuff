import fs from "fs";
import path from "path";

import { ipcMain } from "electron";

let download_path = "";
let mirrors = [];
let is_processing = false;
let current_download = {
    id: null,
    progress: {
        index: 0,
        total: 0
    }
};

const downloaded_maps = new Map();
const bad_status = [204, 401, 403, 408, 410, 500, 503, 504, 429];
const concurrency = 3;
const download_queue = [];

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
            console.error(`error processing item at index ${current_index}:`, error);
        }
        
        await run();
    };

    await Promise.all(Array(Math.min(concurrency, array.length)).fill().map(() => run()));
    return results;
};

const search_map_id = async (hash) => {

    try {

        const response = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        return { ...data, id: data.beatmapset_id };
    } catch (error) {
        console.error("error searching map:", error);
        return null;
    }
};

const save_map_file = (map_path, buffer) => {
    try {
        fs.writeFileSync(map_path, Buffer.from(buffer));
        return true;
    } catch (error) {
        console.error(`[downloader] failed to save file ${map_path}:`, error);
        return false;
    }
};

const update_progress = (win, id, index, total, status) => {

    if (!id || !win) {
        return;
    }
    
    win.webContents.send("progress-update", {
        id,
        current: index,
        length: total,
        status
    });
    
    current_download.progress = {
        index,
        total
    };
};

const try_mirror = async (mirror_url, map_id) => {

    try {

        const response = await fetch(`${mirror_url}${map_id}`, { method: "GET" });
        
        if (response.status == 200) {
            const buffer = await response.arrayBuffer();
            return buffer.byteLength > 0 ? buffer : null;
        }

        if (bad_status.includes(response.status)) {
            return { error: "bad_status" };
        }

        return null;
    } catch (error) {
        return null;
    }
};

const update_mirror = (used_url) => {
    const mirror_index = mirrors.findIndex(m => m.url == used_url);
    if (mirror_index != -1) {
        const [mirror] = mirrors.splice(mirror_index, 1);
        mirrors.push(mirror);
    }
};

const get_buffer = async (map_id) => {

    for (const mirror of mirrors) {

        const result = await try_mirror(mirror.url, map_id);
        
        if (result?.error == "bad_status") {
            update_mirror(mirror.url);
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
    
    if (current_download.id !== id) {
        return { stop: true };
    }

    try {

        const map_data = await search_map_id(map.hash);
        
        if (!map_data) {
            update_progress(win, id, index, total, { hash: map.hash, success: false });
            return null;
        }

        const map_path = path.resolve(download_path, `${map_data.beatmapset_id}.osz`);

        if (fs.existsSync(map_path)) {
            update_progress(win, id, index, total, { hash: map.hash, success: true });
            return null;
        }

        const map_buffer = await get_buffer(map_data.beatmapset_id);

        if (!map_buffer) {
            update_progress(win, id, index, total, { hash: map.hash, success: false });
            return null;
        }

        const saved = save_map_file(map_path, map_buffer);
        
        if (saved) {
            downloaded_maps.set(map_data.beatmapset_id, { 
                ...map_data, 
                checksum: map.hash, 
                md5: map.hash 
            });
        }

        update_progress(win, id, index, total, { hash: map.hash, success: saved });
        return map_data;
    } catch (error) {
        console.error("download failed:", error);
        update_progress(win, id, index, total, { hash: map.hash, success: false });
        return null;
    }
};

const process_queue = async (win) => {

    if (download_queue.length == 0) {
        is_processing = false;
        return;
    }

    const { maps, id } = download_queue.shift();
    
    is_processing = true;
    current_download.id = id;
    current_download.progress = {
        index: 0,
        total: maps.length
    };

    win.webContents.send("download-create", { id });
    
    await parallel_map(maps, 
        (map, index) => process_map(win, map, index + 1, { id, total: maps.length }), 
        concurrency
    );
    
    win.webContents.send("progress-end", { id, success: true });
    
    current_download.id = null;
    process_queue(win);
};

export const init_downloader = (win) => {

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
            console.error("Error updating download path:", error);
            return false;
        }
    });

    ipcMain.handle("create-download", (_, id, hashes) => {
        if (!hashes || hashes.length == 0) {
            return false;
        }
        
        const maps = hashes.map(hash => ({ hash }));
        download_queue.push({ maps, id });
        
        if (!is_processing) {
            process_queue(win);
        }
        
        return true;
    });

    ipcMain.handle("stop-download", (_, id) => {

        const queue_index = download_queue.findIndex(item => item.id == id);

        if (queue_index !== -1) {
            download_queue.splice(queue_index, 1);
            return true;
        }
        

        if (current_download.id == id) {

            current_download.id = null;
            win.webContents.send("progress-end", { id, success: false });
            
            setTimeout(() => {
                process_queue(win);
            }, 100);
            
            return true;
        }
        
        return false;
    });
};
