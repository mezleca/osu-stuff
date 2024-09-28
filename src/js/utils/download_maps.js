import { core } from "./config.js";
import { add_alert } from "../popup/popup.js";
import { events } from "../events.js";
import { initialize } from "../manager/manager.js";

export let current_download = null;

const downloaded_maps = [];
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

export const search_map_id = async (hash) => {

    try {

        const response = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${core.login.access_token}`
            }
        });

        const data = await response.json();

        if (!data) {
            return null;
        }

        data.id = data.beatmapset_id;
        return data;
    } catch(err) {
        console.log("failed to search map id", hash);
        return null;
    }
};

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
        return add_alert("Missing id", { type: "error" });
    }

    if (!maps) {
        add_alert("No maps to download");
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
        this.m_length = maps.length;
        this.stop = false;
        this.id = id;
    }

    get_progress() {
        return { index: this.current_index, length: this.m_length };
    }

    update_progress(index) {

        if (index > this.current_index || this.current_index == 0) {
            this.current_index = index;
        }

        const perc = Math.floor(this.current_index / this.m_length * 100);
        events.emit("progress-update", { id: this.id, perc: perc, i: this.current_index, l: this.m_length });
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

        if (!data || !data.beatmapset_id) {
            return { map: null, data: null };
        }

        if (downloaded_maps.includes(data.beatmapset_id)) {
            return { map, data };
        }

        return {
            map: { checksum: map.hash, id: data.beatmapset_id, ...data },
            data
        };
    }

    async search_beatmap(url, id) {
        try {
            return await fetch(`${url}${id}`, { method: "GET" });
        } catch (err) {
            return null;
        }
    }

    async get_buffer(url, data) {

        const id = data?.id ? data.id : data;

        try {

            const response = await this.search_beatmap(url, id);

            if (!response) {
                return null;
            }

            if (bad_status.includes(response.status)) {
                this.update_mirror(url);
            }

            if (response.status != 200) {
                return null;
            }

            const buffer = await response.arrayBuffer();

            if (buffer.byteLength == 0) {
                return null;
            }

            return buffer;
        } catch(err) {
            return null;
        }
    }

    update_mirror(url) {
        const current_mirror = mirrors.find(mirror => mirror.url == url);
        mirrors = mirrors.filter(mirror => mirror.url != url).concat(current_mirror);
    }

    async find_map(mirror, id) {

        if (!id) {
            return null;
        }

        if (!mirror.length) {
            return await this.get_buffer(mirror, id);
        }

        for (let mirror of mirrors) {

            const map_buffer = await this.get_buffer(mirror.url, id);

            if (map_buffer != null) {
                return map_buffer;
            }
        }

        return null;
    }

    async download_map(map, data) {

        const Path = path.resolve(await core.config.get("osu_songs_path"), `${map.id}.osz`);

        if (!is_testing && (fs.existsSync(Path) || fs.existsSync(path.resolve(await core.config.get("osu_songs_path"), `${map.id}`)))) {
            console.log("??");
            return data;
        }

        const osz_buffer = Object.keys(map).length > 1 
            ? await this.find_map(mirrors, map) 
            : await this.find_map(mirrors, map.id);

        if (!osz_buffer) {
            console.log("buffer is not valid");
            return null;
        }

        map.md5 = map.checksum;
        core.reader.osu.beatmaps.set(map.checksum, map);
        downloaded_maps.push(map.id);

        if (!is_testing) {
            await fs.writeFileSyncView(Path, osz_buffer);
        }

        return data;
    }

    async download(map, index) {
        
        if (this.stop) {
            return { stop: true };
        }

        this.update_progress(index);

        const { map: update_map, data } = await this.get_map_data(map);

        if (!update_map) {
            console.log(data, update_map);
            return null;
        }

        try {
            console.log()
            const map = await this.download_map(update_map, data);
            return map;
        } catch(err) {
            console.log("err", err);
            this.update_progress(index);
            return null;
        }
    }

    async init(single) {

        if (!this.maps || !this.id) {
            console.log("found 0 beatmaps");
            cancel_download();
            return null;
        }

        if (single) {
            const beatmap = await this.download(this.maps, 0);
            await initialize({ no_update: true });
            console.log(beatmap);
            return beatmap;
        }

        await pmap(this.maps, this.download.bind(this), concurrency);
        await initialize();

        if (!this.stop) {
            add_alert("Finished downloading");
            events.emit("progress-end", this.id, true);
        }
    }
};