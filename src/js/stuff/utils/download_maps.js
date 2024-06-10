const fs = require("fs");
const path = require("path");

import { config } from "./config.js";
import { add_alert } from "../../popup/alert.js";
import { events } from "../../tasks/events.js";
import { login } from "./config.js";

import pMap from 'https://cdn.jsdelivr.net/npm/p-map@7.0.2/+esm';

// import { filter } from "../functions/filter.js";

const downloaded_maps = [];

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
        //console.log(err);
        return null;
    }
};

export const mirrors = [
    {
        name: "direct",
        url: "https://api.osu.direct/d/"
    },
    {
        name: "nerinyan",
        url: "https://api.nerinyan.moe/d/"
    }
];

export const download_maps = async (maps, id) => {

    if (!id) {
        return add_alert("Missing id");
    }

    add_alert("started download for " + id);

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
    }

    finish = (id) => {
        add_alert("Finished downloading", id);
        events.emit("progress-end", this.id);
    };

    get_progress = () => {
        return { index: this.current_index, length: this.m_length, log: this.log };
    }

    get_buffer = async (url, data) => {

        const id = data?.id ? data.id : data;

        try {

            const response = await fetch(`${url}${id}`, { method: "GET", headers: { responseType: "arraybuffer" } });

            if (response.status != 200) {
                console.log(`failed to download: ${id}`);
                return null;
            }

            const bmdata = await response.arrayBuffer();
            const buffer = Buffer.from(bmdata);
            
            if (!buffer) {
                console.log("Invalid buffer", id);
                return null;
            }

            return buffer;

        } catch(err) {
            console.log(err);
            this.log = `failed to download: ${id}`;
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

        if (!map.id) {
        
            if (!map.hash) {
                this.log = "invalid map " + map.id;
                return;
            }
    
            const beatmap = await search_map_id(map.hash);
    
            if (beatmap == null) {
                this.log = "Failed to find beatmap hash: " + (map.hash || "") + " " + map;
                return;
            }
    
            if (!beatmap.beatmapset_id) {
                return;
            }

            if (downloaded_maps.includes(beatmap.beatmapset_id)) {
                return;
            }
    
            const c_checksum = map.hash;
    
            map = { checksum: c_checksum, id: beatmap.beatmapset_id, ...beatmap };
        }
    
        const Path = path.resolve(config.get("osu_songs_path"), `${map.id}.osz`);
    
        try {

            if (fs.existsSync(Path) || fs.existsSync(path.resolve(config.get("osu_songs_path"), `${map.id}`))) {
                console.log(`beatmap: ${map.id} already exists in your songs folder`);
                return;
            }
        
            const osz_buffer = Object.keys(map).length > 1 ? await this.find_map(mirrors, map) : await this.find_map(mirrors, map.id);
        
            if (osz_buffer == null) {
                console.log("Invalid buffer", map.id);
                return;
            }

            events.emit("progress-update", { id: this.id, perc: perc, i: this.current_index, l: this.m_length });

            fs.writeFileSync(Path, Buffer.from(osz_buffer));
        }
        catch(err) {
            console.log(err);
        }
    }

    init = async () => {

        if (!this.maps || !this.id) {
            cancel_download();
            return;
        }

        this.m_length = this.maps.length;

        await pMap(this.maps, this.download, { concurrency: 5 });

        console.log("Finished downloading");

        this.finish(this.id);
    } 
};