const fs = require("fs");
const path = require("path");
const axios = require("axios");

import { config } from "../config/config.js";
import { add_alert } from "../../../popup/popup.js";
import { events } from "../../../tasks/events.js";
import { login } from "../config/config.js";

const downloaded_maps = [];
const is_testing = process.env.NODE_ENV == "cleide";
const concurrency = 3; 

const pmap = async (array, mapper, concurrency) => {

    const results = [];
    const progress = new Set();
    let index = 0;

    const run = async () => {

        if (index >= array.length) 
            return;

        const current_index = index++;
        progress.add(current_index);

        try {
            const result = await mapper(array[current_index], current_index, array);
            results[current_index] = result;
        } catch (error) {
            console.error(`Error processing item at index ${current_index}:`, error);
        } finally {
            progress.delete(current_index);
        }

        await run();    
   }

  const workers = Array(Math.min(concurrency, array.length))
    .fill()
    .map(() => run());

  await Promise.all(workers);

  return results;
};

export const search_map_id = async (hash) => {

    try {

        const response = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${login.access_token}`
            }
        });

        const data = await response.json();

        if (!data) {
            return null;
        }
        
        data.id = data.beatmapset_id;

        return data;

    } catch(err) {
        console.log("Failed to search map id", id);
        return null;
    }
};

export let mirrors = [
    {
        name: "nerynian",
        url: "https://api.nerinyan.moe/d/"
    },
    {
        name: "catboy",
        url: "https://catboy.best/d/"
    },
    {
        name: "beatconnect",
        url: "https://beatconnect.io/b/"
    },
    {
        name: "direct",
        url: "https://api.osu.direct/d/"
    },
];

export const download_map = async (hash) => {

    if (!hash) {
        console.err("[Downloader] Missing hash parameter");
        return;
    }

    const new_download = new MapDownloader({ hash: hash }, "0");
    return await new_download.init(true);
};

export const download_maps = async (maps, id) => {

    if (!id) {
        return add_alert("Missing id", { type: "error" });
    }

    if (maps) {
        add_alert("started download for\n" + id);
        console.log("started download for " + id, maps);
    }

    const new_download = new MapDownloader(maps, id);

    await new_download.init();
};

class MapDownloader {
    
    constructor(maps, id) {
        this.maps = maps;
        this.current_index = 0;
        this.m_length = 0;
        this.id = id;
        this.log = "";
    };

    get_progress = () => {
        return { index: this.current_index, length: this.m_length, log: this.log };
    }

    update_mirror = (url) => {

        const old_mirror = new Object(mirrors);

        const mirror_index = old_mirror.findIndex(mirror => mirror.url == url); 
        const current_mirror = old_mirror[mirror_index];

        mirrors = [];

        for (let i = 0; i < old_mirror.length; i++) {

            if (i == mirror_index) {
                continue;
            }

            mirrors.push(old_mirror[i]);
        }

        mirrors.push(current_mirror);

        return null;
    };

    get_buffer = async (url, data) => {

        const id = data?.id ? data.id : data;

        try {

            const response = await axios.get(`${url}${id}`, { 
                responseType: "arraybuffer", 
                headers: {
                    'Accept': 'application/octet-stream'
                }
            });

            if (response.status >= 500 || response.status == 429) {
                this.update_mirror(url);
            }

            if (response.status != 200) {
                console.log("Beatmap not found");
                return null;
            }

            const bmdata = response.data;
            const buffer = Buffer.from(bmdata);
            
            if (!buffer) {
                console.log("Invalid buffer", id);
                return null;
            }

            return buffer;

        } catch(err) {
            console.log(err);
            return null;
        }
    }

    find_map = async (mirror, id) => {

        const is_list = mirror.length ? true : false;
        const buffer = [];

        // search using the mirror url
        if (!is_list) {
            
            const buffer = await this.get_buffer(mirror, id);
            
            if (buffer == null) {
                return null;
            }

            return buffer;
        }
        
        // look through the beatmaps mirrors
        for (let i = 0; i < mirrors.length; i++) {

            const mirror = mirrors[i];

            if (!mirror.url || !id) {
                return null;
            }

            const map_buffer = await this.get_buffer(mirror.url, id);

            if (map_buffer == null) {
                continue;
            }

            buffer.push(map_buffer);
            break;
        }

        return buffer.length == 0 ? null : buffer[0];
    }

    download = async (map, index) => {

        if (index > this.current_index || this.current_index == 0) {
            this.current_index = index;
        }

        const perc = Math.floor(this.current_index / this.m_length * 100);
        let data = {};

        if (!map.id) {
        
            if (!map.hash) {
                this.log = "invalid map " + map.id;
                return null;
            }
    
            const beatmap = await search_map_id(map.hash);
            data = beatmap;
    
            if (beatmap == null) {
                this.log = "Failed to find beatmap hash: " + (map.hash || "") + " " + map;
                return null;
            }
    
            if (!beatmap.beatmapset_id) {
                return null;
            }

            if (downloaded_maps.includes(beatmap.beatmapset_id)) {
                console.log(`beatmap: ${beatmap.beatmapset_id} is already downloaded`);
                return data;
            }
    
            const c_checksum = map.hash;
    
            map = { checksum: c_checksum, id: beatmap.beatmapset_id, ...beatmap };
        }
    
        const Path = path.resolve(config.get("osu_songs_path"), `${map.id}.osz`);
    
        try {

            if (!is_testing && (fs.existsSync(Path) || fs.existsSync(path.resolve(config.get("osu_songs_path"), `${map.id}`)))) {
                console.log(`beatmap: ${map.id} already exists in your songs folder`);
                return data;
            }
        
            const osz_buffer = Object.keys(map).length > 1 ? await this.find_map(mirrors, map) : await this.find_map(mirrors, map.id);
        
            if (osz_buffer == null) {
                console.log("Invalid buffer", map.id);
                return null;
            }

            events.emit("progress-update", { id: this.id, perc: perc, i: this.current_index, l: this.m_length });

            downloaded_maps.push(map.id);

            if (is_testing) {
                return data;
            }
            
            fs.writeFileSync(Path, Buffer.from(osz_buffer));

            return data;
        }
        catch(err) {
            events.emit("progress-update", { id: this.id, perc: perc, i: this.current_index, l: this.m_length });
            return null;
            //console.log(err);
        }
    }

    init = async (single) => {

        if (!this.maps || !this.id) {
            cancel_download();
            return null;
        }

        this.m_length = this.maps.length;

        if (single) {
            const beatmap = await this.download(this.maps, 0);
            return beatmap;
        }

        await pmap(this.maps, this.download, concurrency);

        add_alert("Finished downloading");

        events.emit("progress-end", this.id, true);
    } 
};