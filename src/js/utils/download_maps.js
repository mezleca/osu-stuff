import { core } from "./config.js";
import { create_alert } from "../popup/popup.js";
import { events } from "../events.js";
import { initialize } from "../manager/manager.js";
import { osu_fetch } from "./other/fetch.js";

export let current_download = null;

const downloaded_maps = new Set();
const bad_status = [204, 401, 403, 408, 410, 500, 503, 504, 429];
const is_testing = window.electron.dev_mode;
const concurrency = 3;

const path = window.nodeAPI.path;
const fs = window.nodeAPI.fs;

const pmap = async (array, mapper, concurrency) => {

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
            console.error(`Error processing item at index ${current_index}:`, error);
        }
        
        await run();
    };

    await Promise.all(Array(Math.min(concurrency, array.length)).fill().map(() => run()));
    return results;
};

export async function search_map_id(hash) {
    const data = await osu_fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`);
    if (!data) {
        return null;
    }
    return { ...data, id: data.beatmapset_id };
}

export let mirrors = [
    { name: "nerynian", url: "https://api.nerinyan.moe/d/" },
    { name: "beatconnect", url: "https://beatconnect.io/b/" },
    { name: "direct", url: "https://osu.direct/api/d/" },
    { name: "catboy", url: "https://catboy.best/d/" }
];

export const download_map = async (hash) => {

    if (!hash) {
        console.error("[Downloader] Missing hash parameter");
        return;
    }

    const new_download = new map_downloader({ hash: hash }, "0");
    return await new_download.init(true);
};

export const download_maps = async (maps, id) => {

    if (!id) {
        return create_alert("Missing id", { type: "error" });
    }

    if (!maps) {
        create_alert("0 maps to download");
        return;
    }

    const new_download = new map_downloader(maps, id);
    current_download = new_download;
    await new_download.init();
};

class map_downloader {

    constructor(maps, id) {
        this.maps = maps;
        this.current_index = 0;
        this.total_maps = maps.length;
        this.should_stop = false;
        this.id = id;
    }

    update_progress(index) {

        if (index > this.current_index || this.current_index === 0) {
            this.current_index = index;
        }

        events.emit("progress-update", {
            id: this.id,
            perc: Math.floor((this.current_index / this.total_maps) * 100),
            i: this.current_index,
            l: this.total_maps
        });
    }

    async get_map_data(map) {

        if (map.id) {
            return { map, data: {} };
        }

        if (!map.hash) {
            return { map: null, data: null };
        }

        if (core.reader.osu.beatmaps.has(map.hash)) {
            return { map, data: core.reader.osu.beatmaps.get(map.hash) };
        }

        const data = await search_map_id(map.hash);

        if (!data?.beatmapset_id || downloaded_maps.has(data.beatmapset_id)) {
            return { map: null, data: null };
        }

        return {
            map: { checksum: map.hash, id: data.beatmapset_id, ...data },
            data
        };
    }

    async try_mirror(mirror_url, map_id) {
        try {
            const response = await fetch(`${mirror_url}${map_id}`, { method: "GET" });
            
            if (response.status === 200) {
                const buffer = await response.arrayBuffer();
                return buffer.byteLength > 0 ? buffer : null;
            }

            if (bad_status.includes(response.status)) {
                this.update_mirror(mirror_url);
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    update_mirror(used_url) {
        const mirror_index = mirrors.findIndex(m => m.url === used_url);
        if (mirror_index !== -1) {
            const [mirror] = mirrors.splice(mirror_index, 1);
            mirrors.push(mirror);
        }
    }

    async find_map_buffer(map_id) {
        for (const mirror of mirrors) {
            const buffer = await this.try_mirror(mirror.url, map_id);
            if (buffer) {
                return buffer;
            }
        }
        return null;
    }

    async download_map(map, data) {

        const map_path = path.resolve(core.config.get("osu_songs_path"),`${map.id}.osz`);
        const extracted_path = path.resolve(core.config.get("osu_songs_path"),`${map.id}`);

        if (!is_testing && (fs.existsSync(map_path) || fs.existsSync(extracted_path))) {
            return data;
        }

        const map_buffer = await this.find_map_buffer(map.id);

        if (!map_buffer) {
            return null;
        }

        if (!is_testing) {
            await fs.writeFileSyncView(map_path, map_buffer);
        }

        map.md5 = map.checksum;
        core.reader.osu.beatmaps.set(map.checksum, map);
        downloaded_maps.add(map.id);

        return data;
    }

    async process(map, index) {

        if (this.should_stop) {
            return { stop: true };
        }

        this.update_progress(index);

        const { map: updated_map, data } = await this.get_map_data(map);

        if (!updated_map) {
            return null;
        }

        try {
            return await this.download_map(updated_map, data);
        } catch (error) {
            console.error("download failed:", error);
            this.update_progress(index);
            return null;
        }
    }

    async init(single_map = false) {

        if (!this.maps || !this.id) {
            console.log("no beatmaps to download");
            current_download = null;
            return null;
        }

        if (single_map) {
            const result = await this.process(this.maps, 0);
            await initialize({ no_update: true });
            return result;
        }

        await pmap(this.maps, this.process.bind(this), concurrency);
        await initialize();

        if (!this.should_stop) {
            create_alert("download completed");
            events.emit("progress-end", this.id, true);
        }
    }
};