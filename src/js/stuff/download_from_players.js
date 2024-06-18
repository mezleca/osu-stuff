const axios = require("axios");
const path = require("path");
const fs = require("fs");

import { config } from "./utils/config.js";
import { events } from "../tasks/events.js";
import { add_alert } from "../popup/alert.js";
import { add_get_extra_info } from "../popup/alert.js";
import { download_maps } from "./utils/download_maps.js";
import { files, reader } from "./collector.js";

const url_is_valid = (url) => {

    try {
        
        const player_url = new URL(url);

        if (player_url.hostname != "osu.ppy.sh") {
            console.log(player_url);
            return false;
        }

        return true;

    } catch(err) {
        return false;
    }
};

const add_to_collection = (maps, id, name, type) => {

    if (maps.length == 0) {
        console.log("no maps");
        events.emit("progress-end", id);
        return;
    }

    const collection = files.get("collection");
    reader.set_type("collection");
    reader.set_buffer(collection, true);

    if (reader.collections.length == 0) {
        reader.get_collections_data();
    }

    reader.collections.beatmaps.push({
        name: `!stuff - ${name} ${type}`,
        maps: [...maps]
    });

    reader.collections.length++;

    console.log(reader.collections);

    // backup
    const backup_name = `collection_backup_${Date.now()}.db`;
    fs.renameSync(path.resolve(config.get("osu_path"), "collection.db"), path.resolve(config.get("osu_path"), backup_name));

    reader.write_collections_data(path.resolve(config.get("osu_path"), "collection.db"));

    console.log("added to collection");
}

export const download_from_players = async (id) => {

    const maps = [];

    const methods = { "best performance": "best", "first place": "firsts" };

    const _method =  await add_get_extra_info([{
        type: "list",
        value: Object.keys(methods),
        important: false,
        column: true,
        title: "Select a method"
    }]);

    const method = methods[_method];

    if (!_method || !method) {
        events.emit("progress-end", id);
        return;
    }

    const player = await add_get_extra_info([{
        type: "input",
        text: "player url",
        important: false
    }]);

    if (!player) {
        events.emit("progress-end", id);
        return;
    }

    if (!url_is_valid(player)) {
        add_alert("Invalid player url:", player, { type: "error" });
        events.emit("progress-end", id);
        return;
    }
    
    const url = `${player}/scores/${method}?mode=osu`;
    const player_req = await axios.get(`${player}/extra-pages/top_ranks?mode=osu`);

    if (player_req.status != 200) {
        add_alert("Invalid player url", player, { type: "error" });
        events.emit("progress-end", id);
        return;
    }

    const count = player_req.data[method].count;

    if (count == 0) {
        add_alert("No beatmaps was found", player, { type: "error" });
        events.emit("progress-end", id);
        return;
    }

    add_alert(`Searching ${count} beatmaps...`);
    
    let offset = player_req.data[method].items.length;

    maps.push(...player_req.data[method].items);

    for (let i = 0; i < count; i++) {

        if (count <= 5) {
            break; 
        }

        if (offset >= count) {
            break;
        }

        const max_limit = count - offset < 100 ? count - offset : 100;

        const response = await axios.get(`${url}&limit=${max_limit}&offset=${offset}`);
        const data = response.data;
        
        if (response.status != 200) {
            offset += max_limit;
            console.log("Error", response.status, response);
            continue;
        }

        for (let i = 0; i < data.length; i++) {

            const beatmap = data[i];
            
            if (!beatmap) {
                continue;
            }

            maps.push(beatmap);
        }

        offset += max_limit;
    }

    if (maps.length == 0) {
        add_alert("No beatmaps was found", { type: "warning" });
        events.emit("progress-end", id);
        return;
    }

    add_alert(`Found ${maps.length} valid beatmaps`);

    const _download = await add_get_extra_info([{
        type: "list",
        value: ["Download", "Add to collections", "Both"],
        important: false,
        column: true,
        input_type: "url"
    }]);

    if (!_download) {
        events.emit("progress-end", id);
        return;
    }
    
    if (_download == "Add to collections") {
        add_to_collection(maps.map((b) => b.beatmap.checksum), id, maps[0].user.username, method == "firsts" ? "first place" : "best performance");
        events.emit("progress-end", id);
        return;
    }

    if (_download == "Both") {
        add_to_collection(maps.map((b) => b.beatmap.checksum), id, maps[0].user.username, method == "firsts" ? "first place" : "best performance");
    }

    await download_maps(maps.map((s) => { return { id: s.beatmap.beatmapset_id }}), id);
};