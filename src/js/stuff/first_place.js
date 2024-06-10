const axios = require("axios");

import { events } from "../tasks/events.js";
import { add_alert } from "../popup/alert.js";
import { add_get_extra_info } from "../popup/alert.js";
import { download_maps } from "./utils/download_maps.js";

export const first_place = async (id) => {

    const maps = [];

    const methods = { "best performance": "best", "first place": "firsts" };

    const _method =  await add_get_extra_info([{
        type: "list",
        value: Object.keys(methods),
        important: false,
        column: true
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
    
    const url = `${player}/scores/${method}?mode=osu`;
    const player_req = await axios.get(`${player}/extra-pages/top_ranks?mode=osu`);

    if (player_req.status != 200) {
        add_alert("Invalid player url", player);
        events.emit("progress-end", id);
        return;
    }

    const count = player_req.data[method].count;

    if (count == 0) {
        add_alert("No beatmaps was found", player);
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

    add_alert(`Found ${maps.length} valid beatmaps`);

    if (maps.length == 0) {
        add_alert("No beatmaps was found");
        events.emit("progress-end", id);
        return;
    }

    await download_maps(maps.map((s) => { return { id: s.beatmap.beatmapset_id }}), id);
};