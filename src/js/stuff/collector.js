const fs = require("fs");
const path = require("path");

import { events } from "../tasks/events.js";
import { add_alert } from "../popup/alert.js";
import { login, config, reader } from "./utils/config/config.js";
import { url_is_valid } from "./download_from_players.js";
import { collections, initialize } from "../manager/manager.js";



const is_testing = process.env.NODE_ENV == "cleide";

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

    if (!login) {
        add_alert("forgot to configurate? :P");
        console.log("[Collector] Login not found\n");
        return null;
    }

    if (!url_is_valid(url, "osucollector.com")) {
        add_alert("Invalid url", { type: "error" });
        return null;   
    }

    const url_array = url.split("/");
    const collection_id = url_array.find((a) => Number(a));

    if (!collection_id) {
        add_alert("invalid url", { type: "error" });
        return null;
    }

    const osu_file = files.get("osu");
    const is_tournament = url_array.includes("tournaments");
    const collection_url = `https://osucollector.com/api/collections/${collection_id}`;

    console.log(`[Collector] Fetching collection ${collection_id}...`);

    const Rcollection = is_tournament ? await get_tournament_maps(collection_id) : await fetch(collection_url);
    const collection = is_tournament ? Rcollection : (await Rcollection.json());

    if (Rcollection.status != 200) {
        add_alert("invalid collection", { type: "error" });
        return null;
    }

    if (!collection.beatmapsets) {
        add_alert("Failed to get collection from osuo cllector", { type: "error" });
        return null;
    }

    reader.set_type("osu");
    reader.set_buffer(osu_file, true);

    if (!reader.osu.beatmaps?.length) {
        console.log("[Collector] reading osu.db file...\n");
        await reader.get_osu_data();
    }

    const maps_hashes = new Set(reader.osu.beatmaps.keys());

    const collection_hashes = is_tournament ? 
    [...new Set(
        collection.beatmapsets.map((b) => b.checksum)
    )]
    : // else
    [...new Set(
        collection.beatmapsets.flatMap(
          (b) => b.beatmaps.map((b) => b.checksum)
        )
    )];
    
    const maps = is_tournament ?
    collection.beatmapsets.filter((beatmap) => {
        return !maps_hashes.has(beatmap.checksum) && beatmap.checksum && beatmap.beatmapset;
    }).map((b) => b.beatmapset )
    : // else
    collection.beatmapsets.filter((beatmapset) => {
        return !beatmapset.beatmaps.some((beatmap) => maps_hashes.has(beatmap.checksum));
    });

    return { maps: maps, c_maps: collection_hashes, collection: collection };
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
    
        await reader.get_collections_data();

        const new_name = "!stuff - " + collection.name;
    
        reader.collections.beatmaps.push({
            name: new_name,
            maps: c_maps
        });
    
        reader.collections.length++;

        // update the manager
        collections.set(new_name, c_maps.map((v) => {
            return { md5: v };
        }));

        await initialize();
    
        if (is_testing) {
            add_alert("Your collection file has been updated!");
            resolve(`Your collection file has been updated!`);
            return;
        }
    
        // backup 
        const backup_name = `collection_backup_${Date.now()}.db`;
        fs.renameSync(path.resolve(config.get("osu_path"), "collection.db"), path.resolve(config.get("osu_path"), backup_name));
    
        // write the new file
        reader.write_collections_data(path.resolve(config.get("osu_path"), "collection.db"));
    
        add_alert("Your collection file has been updated!");
        resolve(`Your collection file has been updated!`);
    });  
}