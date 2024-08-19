const fs = require("fs");
const path = require("path");
const axios = require("axios");

import { config } from "../config/config.js";
import { add_alert } from "../../../popup/popup.js";
import { events } from "../../../tasks/events.js";
import { login, reader } from "../config/config.js";
import { initialize } from "../../../manager/manager.js";

export let current_download = null;

const downloaded_maps = [], bad_status = [204, 401, 403, 408, 410, 500, 503, 504, 429], shit_interval_mirror_lest = [];
const is_testing = process.env.NODE_ENV == "cleide";
const concurrency = 3;

// https://stackoverflow.com/questions/49967779/axios-handling-errors
axios.interceptors.response.use(function (response) {
    return response;
  }, function (error) {
    return Promise.reject(error);
});

const pmap = async (array, mapper, concurrency) => {

    const results = [];
    const progress = new Set();

    let index = 0;
    let should_stop = false;

    const run = async () => {

        if (index >= array.length || should_stop) {
            return;
        }       

        const current_index = index++;
        progress.add(current_index);

        try {
            
            const result = await mapper(array[current_index], current_index, array);

            if (result?.stop) {
                should_stop = true;
                return;
            }

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
        name: "beatconnect",
        url: "https://beatconnect.io/b/"
    },
    {
        name: "direct",
        url: "https://api.osu.direct/d/"
    },
    {
        name: "catboy",
        url: "https://catboy.best/d/"
    }
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

    if (!maps) {
        add_alert("No maps to download");
        return;
    }

    const new_download = new MapDownloader(maps, id);
    current_download = new_download;

    await new_download.init();
};

class MapDownloader {
    
    constructor(maps, id) {
        this.maps = maps;
        this.current_index = 0;
        this.m_length = 0;
        this.stop = false;
        this.id = id;
    };

    get_progress = () => {
        return { index: this.current_index, length: this.m_length };
    };

    update_mirror = (url) => {
        const current_mirror = mirrors.find(mirror => mirror.url == url);
        mirrors = mirrors.filter(mirror => mirror.url != url).concat(current_mirror);
    };

    // axios keep going to catch when the beatmap is not found so yeah
    search_beatmap = async (url, id) => {

        return new Promise((resolve) => {

            axios.get(`${url}${id}`, { 
                responseType: "arraybuffer", 
            })
            .then((r) => {
                resolve(r);
            })
            .catch((e) => {
    
                if (e?.response) {
                    return resolve(e.response);
                }
    
                resolve(null);
            });
        })     
    };

    get_buffer = async (url, data) => {

        const id = data?.id ? data.id : data;

        try {

            const response = await this.search_beatmap(url, id);

            if (!response) {
                return;
            }

            // not sure if i will need this anymore but yeah
            // if (response.status == 504 || response.status == 409) {

            //     console.log("FUcking");
                
            //     // save the old mirror for later
            //     const current_mirror = mirrors.find(mirror => mirror.url == url);
            //     mirrors = mirrors.filter(mirror => mirror.url != url);
                
            //     const timeout = setTimeout(() => {
            //         console.log(`[DOWNLOAD SHIT] ${current_mirror.name} is so ufcking back`);
            //         mirrors.concat(current_mirror);
            //         clearTimeout(timeout);           
            //     }, 1000 * 60); // 1min

            //     console.log(mirrors);
            // }

            if (bad_status.includes(response.status)) {
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
            return null;
        }
    }

    find_map = async (mirror, id) => {

        const is_list = mirror.length ? true : false;

        if (!id) {
            return null;
        }

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
            const map_buffer = await this.get_buffer(mirror.url, id);

            if (map_buffer == null) {
                continue;
            }

            return map_buffer;
        }

        return null;
    }

    download = async (map, index) => {

        if (this.stop) {
            return { stop: true };
        }

        if (index > this.current_index || this.current_index == 0) {
            this.current_index = index;
        }

        const perc = Math.floor(this.current_index / this.m_length * 100);
        let data = {};

        if (!map.id) {
        
            // check if the hash exist
            if (!map.hash) {
                console.log("invalid map " + map.id);
                return null;
            }

            // check if the beatmap hash is already in your osu_db
            if (reader.osu.beatmaps.has(map.hash)) {
                console.log(map.hash, "is already in your osu.db file");
                return reader.osu.beatmaps.get(map.hash);
            }
    
            data = await search_map_id(map.hash);
    
            // map not found
            if (data == null) {
                console.log("Failed to find beatmap hash: " + (map.hash || "") + " " + map);
                return null;
            }
    
            // idk, but i want to make sure this is in the response
            if (!data.beatmapset_id) {
                return null;
            }

            // already downloaded later :+1:
            if (downloaded_maps.includes(data.beatmapset_id)) {
                console.log(`beatmap: ${data.beatmapset_id} is already downloaded`);
                return data;
            }
    
            const c_checksum = map.hash;
    
            map = { checksum: c_checksum, id: data.beatmapset_id, ...data };
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

            map.md5 = map.checksum;

            // this might cause some problems to manager but yea
            reader.osu.beatmaps.set(map.checksum, map);

            if (is_testing) {
                return data;
            }
            
            fs.writeFileSync(Path, Buffer.from(osz_buffer));

            return data;
        }
        catch(err) {
            events.emit("progress-update", { id: this.id, perc: perc, i: this.current_index, l: this.m_length });
            return null;
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

            // update manager
            await initialize({ no_update: true });

            return beatmap;
        }

        await pmap(this.maps, this.download, concurrency);

        // update manager
        await initialize();

        if (!this.stop) {
            add_alert("Finished downloading");
            events.emit("progress-end", this.id, true);
        }
    } 
};