import { core } from "../app.js";
import { create_alert } from "../popup/popup.js";

import { initialize } from "../manager/manager.js";
import { osu_fetch } from "./other/fetch.js";
import { fs, path, is_testing } from "./global.js";

let is_processing = false;

export let current_download = {
    stop: false,
    id: 0,
    progress: {
        index: 0,
        total: 0,
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

        if (index >= array.length || should_stop || current_download.should_stop) {
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
            console.error(`Error processing item at index ${current_index}:`, error);
        }
        
        await run();
    };

    await Promise.all(Array(Math.min(concurrency, array.length)).fill().map(() => run()));
    return results;
};

export const search_map_id = async (hash) => {
    const data = await osu_fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`);
    if (!data) {
        return null;
    }
    return { ...data, id: data.beatmapset_id };
};

export const save_map_file = (map_path, buffer) => {

    if (is_testing) {
        return true;
    }
    
    try {
        fs.writeFileSync(map_path, Buffer.from(buffer));
        return true;
    } catch (error) {
        console.error(`[downloader] failed to save file ${map_path}:`, error);
        return false;
    }
};

export const update_progress = (id, index, total) => {

    if (!id) {
        return;
    }
    
    events.emit("progress-update", {
        id: id,
        perc: Math.floor((index / total) * 100),
        i: index,
        l: total
    });
    
    current_download.progress = {
        index,
        total
    };
};

export const get_map_path = () => {
    
    if (core.config.get("lazer_mode")) {
        return core.config.get("export_path");
    }

    return core.config.get("stable_songs_path");
};

export const get_map_data = async (map) => {

    if (map.id) {
        return { map, data: {} };
    }

    if (!map.hash) {
        return { map: null, data: null };
    }

    if (core.reader.osu.beatmaps.has(map.hash)) {
        console.log(`[downloader] ${map.hash} already downloaded`);
        return { map, data: core.reader.osu.beatmaps.get(map.hash) };
    }

    const data = await search_map_id(map.hash);
    
    if (!data?.beatmapset_id) {
        return { map: null, data: null };
    }
    
    const map_path = path.resolve(get_map_path(), `${data.beatmapset_id}.osz`);

    if (fs.existsSync(map_path)) {
        return { map: null, data: null };
    }

    if (downloaded_maps.has(data.beatmapset_id)) {
        return { map: downloaded_maps.get(data.beatmapset_id), data: data };
    }

    return {
        map: { checksum: map.hash, id: data.beatmapset_id, ...data },
        data
    };
};

export const try_mirror = async (mirror_url, map_id, mirrors) => {

    try {

        const response = await fetch(`${mirror_url}${map_id}`, { method: "GET" });
        
        if (response.status == 200) {
            const buffer = await response.arrayBuffer();
            return buffer.byteLength > 0 ? buffer : null;
        }

        if (bad_status.includes(response.status)) {
            update_mirror(mirror_url, mirrors);
        }

        return null;
    } catch (error) {
        return null;
    }
};

export const update_mirror = (used_url, mirrors) => {
    const mirror_index = mirrors.findIndex(m => m.url == used_url);
    if (mirror_index != -1) {
        const [mirror] = mirrors.splice(mirror_index, 1);
        mirrors.push(mirror);
    }
};

export const get_buffer = async (map_id, mirrors) => {
    for (const mirror of mirrors) {
        const buffer = await try_mirror(mirror.url, map_id, mirrors);
        if (buffer) {
            return buffer;
        }
    }
    return null;
};

export const process_map = async (map, index, options) => {

    console.log("[downloader] searching map", map);

    const { id, should_stop, mirrors } = options;

    if (should_stop.value) {
        return { stop: true };
    }

    update_progress(id, index, options.total);
    
    try {

        const { map: updated_map, data } = await get_map_data(map);

        if (!updated_map) {
            core.progress.update(`failed to download ${updated_map?.id}`);
            return null;
        }

        const map_path = path.resolve(get_map_path(), `${updated_map.id}.osz`);

        if (fs.existsSync(map_path)) {
            core.progress.update(`skipping ${updated_map?.id}`);
            return { map: null, data: null };
        }

        const map_buffer = await get_buffer(updated_map.id, mirrors);

        if (!map_buffer) {
            return null;
        }

        core.progress.update(`downloaded ${updated_map?.id}`);
        const saved = save_map_file(map_path, map_buffer);
        
        if (saved) {
            updated_map.md5 = updated_map.checksum;
            core.reader.osu.beatmaps.set(updated_map.checksum, updated_map);
            downloaded_maps.set(updated_map.id, updated_map);
        }

        return data;
    } catch (error) {
        console.error("download failed:", error);
        update_progress(id, index, options.total);
        return null;
    }
};

export const download_map = async (hash) => {

    if (!hash) {
        console.error("[downloader] missing hash parameter");
        return;
    }

    console.log("[downloader] download single map:", hash);
    
    const mirrors = Array.from(core.mirrors, ([k, v]) => {
        return { name: k, url: v };
    });
    
    const should_stop = { value: false };
    const options = {
        id: "single",
        should_stop,
        mirrors,
        total: 1
    };
    
    const result = await process_map({ hash }, 0, options);
    await initialize({ no_update: true });
    return result;
};

export const download_maps = async (maps, id) => {

    if (!id) {
        create_alert("missing id", { type: "error" });
        return;
    }

    if (!maps || maps.length == 0) {
        core.progress.update("0 maps to download");
        return;
    }
    
    download_queue.push({ maps, id });

    if (!is_processing) {
        process_queue();
    }
};

const process_queue = async () => {

    if (download_queue.length == 0) {
        is_processing = false;
        return;
    }
    
    is_processing = true;
    const { maps, id } = download_queue.shift();
    
    current_download.id = id;
    current_download.progress = {
        index: 0,
        total: maps.length
    };
    
    const mirrors = Array.from(core.mirrors, ([k, v]) => {
        return { name: k, url: v };
    });
    
    const should_stop = { value: false };
    const options = {
        id,
        should_stop,
        mirrors,
        total: maps.length
    };
    
    await parallel_map(maps, (map, index) => process_map(map, index, options), concurrency);
    await initialize();
    
    if (!should_stop.value) {
        create_alert("download completed");
        events.emit("progress-end", id, true);
    }
    
    current_download.id = null;
    
    process_queue();
};

export const cancel_downloads = () => {

    if (current_download.id) {
        events.emit("progress-end", current_download.id, false);
    }
    
    download_queue.length = 0;

    current_download.id = null;
    current_download.progress.index = 0;
    current_download.progress.total = 0;
    is_processing = false;
};
