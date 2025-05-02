import { core } from "../manager/manager.js";

import { create_alert } from "../popup/popup.js";
import { url_is_valid } from "./download_from_players.js";
import { initialize } from "../manager/manager.js";
import { is_testing } from "../utils/global.js";

const get_tournament_maps = async(id) => {

    const response = await fetch(`https://osucollector.com/api/tournaments/${id}`);
    const data = await response.json();

    const maps = [];
    const collection = {};
    const rounds = data.rounds;

    for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i].mods;
        for (let k = 0; k < round.length; k++) {
            const mods = round[k].maps;
            maps.push(...mods);
        }
    }

    collection.name = data.name;
    collection.status = response.status;
    collection.beatmapsets = maps;

    return collection;
};

export const setup_collector = async (url) => {

    if (!core.login) {
        create_alert("forgot to configurate? :P");
        return null;
    }

    if (!url_is_valid(url, "osucollector.com")) {
        create_alert("invalid url", { type: "error" });
        return null;
    }

    const url_array = url.split("/");
    const collection_id = url_array.find(part => Number(part));
    
    if (!collection_id) {
        create_alert("invalid url", { type: "error" });
        return null;
    }

    const is_tournament = url_array.includes("tournaments");
    const api_url = `https://osucollector.com/api/collections/${collection_id}`;
    
    core.progress.update(`fetching collection ${collection_id}...`);
    
    const response = is_tournament ? await get_tournament_maps(collection_id) : await fetch(api_url);
    const collection_data = is_tournament ? response : await response.json();

    if (response.status != 200 || !collection_data.beatmapsets) {
        create_alert("failed to get collection", { type: "error" });
        return null;
    }
    
    let new_maps = null;
    const get_hashes = is_tournament ? beatmapsets => beatmapsets.map(b => b.checksum) : beatmapsets => beatmapsets.flatMap(b => b.beatmaps.map(map => map.checksum));
    const collection_hashes = [...new Set(get_hashes(collection_data.beatmapsets))];

    if (is_tournament) {
        new_maps = collection_data.beatmapsets.map((c) => { return { id: c.id, checksum: c.checksum } })
            .filter((c) => !core.reader.osu.beatmaps.get(c.checksum));
    } else {
        new_maps = collection_data.beatmapsets.flatMap((a) => a.beatmaps.flatMap((c) => { return { id: a.id, checksum: c.checksum } }))
            .filter((c) => !core.reader.osu.beatmaps.get(c.checksum));
    }

    const unique = new Map();

    // return unique
    for (let i = 0; i < new_maps.length; i++) {
        const a = new_maps[i];
        if (!unique.has(a.id)) {
            unique.set(a.id, a);
        }
    }

    return {
        maps: Array.from(unique.values()),
        c_maps: collection_hashes,
        collection: collection_data
    };
};

export const download_collector = async (url, id) => {

    return new Promise(async (resolve, reject) => {
        
        events.emit("progress-update", { id: id, perc: 0 });
  
        const url_array = url.split("/");
        const collection_id = url_array[url_array.length - 2];

        if (!collection_id) {
            reject("invalid url");
            return;
        }

        const setup = await setup_collector(url);

        if (!setup) {
            reject("Invalid collection");
            return;
        }

        resolve(setup.maps);
    });
}

export const add_collection = async (url) => {

    return new Promise(async (resolve, reject) => {

        const { c_maps, collection } = await setup_collector(url);

        const new_name = "!stuff - " + collection.name;
        const maps = c_maps.filter((m) => m != undefined && typeof m == "string");

        // create a new collection
        core.reader.collections.beatmaps.set(new_name, {
            maps: maps
        });
    
        core.reader.collections.length = core.reader.collections.beatmaps.length;

        console.log("[collector] updated collection object", core.reader.collections);
    
        if (is_testing) {
            create_alert("Your collection file has been updated!");
            resolve(`Your collection file has been updated!`);
            return;
        }
        
        // write the new file
        core.reader.write_collections_data();
    
        // update manager
        await initialize();

        create_alert("Your collection file has been updated!");
        resolve(`Your collection file has been updated!`);
    });  
}
