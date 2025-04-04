import { core } from "../app.js";
import { create_alert } from "../popup/popup.js";
import { events } from "../events/emitter.js";
import { initialize } from "../manager/manager.js";
import { osu_fetch } from "./other/fetch.js";
import { fs, path, is_testing } from "./global.js";

export let current_download = null;

const downloaded_maps = new Map();
const bad_status = [204, 401, 403, 408, 410, 500, 503, 504, 429];
const concurrency = 3;

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

export const download_map = async (hash) => {

    if (!hash) {
        console.error("[downloader] Missing hash parameter");
        return;
    }

    console.log("[downloader] download single map:", hash);

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
        this.temp_mirrors = [];
    }

    update_progress(index) {

        if (index > this.current_index || this.current_index == 0) {
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
            console.log(`[downloader] ${map.hash} already downloaded`);
            return { map, data: core.reader.osu.beatmaps.get(map.hash) };
        }

        const data = await search_map_id(map.hash);
        const map_path = path.resolve(core.config.get("stable_songs_path"),`${data.beatmapset_id}.osz`);

        if (fs.existsSync(map_path)) {
            return { map: null, data: null };
        }

        if (!data?.beatmapset_id) {
            return { map: null, data: null };
        }

        if (downloaded_maps.has(data.beatmapset_id)) {
            return { map: downloaded_maps.get(data.beatmapset_id), data: data };
        }

        return {
            map: { checksum: map.hash, id: data.beatmapset_id, ...data },
            data
        };
    }

    async try_mirror(mirror_url, map_id) {
        try {
            const response = await fetch(`${mirror_url}${map_id}`, { method: "GET" });
            
            if (response.status == 200) {
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
        const mirror_index = this.temp_mirrors.findIndex(m => m.url == used_url);
        if (mirror_index != -1) {
            const [mirror] = this.temp_mirrors.splice(mirror_index, 1);
            this.temp_mirrors.push(mirror);
        }
    }

    async get_buffer(map_id) {
        for (const mirror of this.temp_mirrors) {
            const buffer = await this.try_mirror(mirror.url, map_id);
            if (buffer) {
                return buffer;
            }
        }
        return null;
    }

    async download_map(map, data) {

        const map_path = path.resolve(core.config.get("stable_songs_path"),`${map.id}.osz`);

        if (fs.existsSync(map_path)) {
            console.log(`[downloader] skipping ${map?.id}`);
            return { map: null, data: null };
        }

        const map_buffer = await this.get_buffer(map.id);

        if (!map_buffer) {
            return null;
        }

        if (!is_testing) {
            await fs.writeFileSync(map_path, map_buffer);
        }

        map.md5 = map.checksum;
        core.reader.osu.beatmaps.set(map.checksum, map);
        downloaded_maps.set(map.id, map);

        return data;
    }

    async process(map, index) {

        console.log("[downloader] searching map", map);

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
            console.log("[downloader] 0 beatmaps to download");
            current_download = null;
            return null;
        }

        this.temp_mirrors = Array.from(core.mirrors, ([k, v]) => {
            return { name: k, url: v };
        });

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
