const path = require("path");
const fs = require("fs");

import { core } from "../utils/config.js";
import { add_alert } from "../popup/popup.js";
import { add_get_extra_info } from "../popup/popup.js";
import { initialize, add_collection_manager } from "../manager/manager.js";

export const url_is_valid = (url, hostname) => {

    try {
        
        const player_url = new URL(url);

        if (player_url.hostname != hostname) {
            console.log(player_url);
            return false;
        }

        if (!player_url.pathname.match(/\d+/g) && hostname == "osu.ppy.sh") {
            return false;
        }

        return true;

    } catch(err) {
        return false;
    }
};

const add_to_collection = async (maps, name, type) => {

    if (maps.length == 0) {
        console.log("no maps");
        return;
    }

    const collection_name = `!stuff - ${name} ${type}`;

    core.reader.collections.beatmaps.push({
        name: collection_name,
        maps: [...maps]
    });

    core.reader.collections.length = core.reader.collections.beatmaps.length;

    await add_collection_manager(maps, { name: collection_name });

    add_alert(`added ${name} ${type} to your collection!`, { type: "success" });
};

const get_player_id = async (name) => {

    if (!name) {
        return;
    }

    const api_url = "https://osu.ppy.sh/api/v2";
    const req_url = `${api_url}/users/${name}`;

    const response = await fetch(req_url, {
        method: "GET",
        headers: {
            'Authorization': `Bearer ${core.login.access_token}`
        }
    });

    const data = await response.json();

    if (!data?.id) {
        console.log("player", name, "not found");
        return;
    }

    return data.id;
};

export const download_from_players = async (id) => {

    return new Promise(async (resolve, reject) => {

        const maps = [];
        const methods = { "best performance": "best", "first place": "firsts" };

        const _method =  await add_get_extra_info([{
            type: "list",
            value: Object.keys(methods),
            important: false,
            title: "method"
        }]);

        if (!_method) {
            reject("cancelled");
            return;
        }

        const method = methods[_method];

        const player = await add_get_extra_info([{
            type: "input",
            text: "player name",
            important: false
        }]);

        if (!player) {
            return;
        }

        const player_id = await get_player_id(player);

        if (!player_id) {
            add_alert("player", player, "not found");
            return;
        }

        const player_url = `https://osu.ppy.sh/users/${player_id}`;

        if (!url_is_valid(player_url, "osu.ppy.sh")) {
            reject(`invalid player url: ${player}`);
            return;
        }
        
        const url = `${player_url}/scores/${method}?mode=osu`;
        const player_req = await fetch(`${player_url}/extra-pages/top_ranks?mode=osu`);
        const player_data = await player_req.json();

        if (player_req.status != 200) {
            reject(`invalid player url: ${player_url}`);
            return;
        }

        const count = player_data[method].count;

        if (count == 0) {
            reject("no beatmaps found");
            return;
        }

        add_alert(`Searching ${count} beatmaps...`);
        
        let offset = player_data[method].items.length;

        maps.push(...player_data[method].items);

        for (let i = 0; i < count; i++) {

            if (count <= 5) {
                break; 
            }

            if (offset >= count) {
                break;
            }

            const max_limit = count - offset < 100 ? count - offset : 100;

            const response = await fetch(`${url}&limit=${max_limit}&offset=${offset}`);
            const data = await response.json();
            
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
            reject("no beatmaps found");
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
            reject("cancelled");
            return;
        }
        
        if (_download == "Add to collections") {
            await add_to_collection(maps.map((b) => b.beatmap.checksum), maps[0].user.username, method == "firsts" ? "first place" : "best performance");
            resolve("added to collection");
            return;
        }

        if (_download == "Both") {
            await add_to_collection(maps.map((b) => b.beatmap.checksum), maps[0].user.username, method == "firsts" ? "first place" : "best performance");
        }

        const list = maps.map((s) => { return { id: s.beatmap.beatmapset_id }});
        
        console.log("[Download from players] player beatmap list", list);

        resolve(list);
    });
};