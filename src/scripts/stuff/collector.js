const axios = require("axios");
const fs = require("fs");
const path = require("path");

import { OsuReader } from "../reader/reader.js";
import { events } from "../tasks/events.js";
import { add_alert } from "../popup/alert.js";
import { download_maps } from "./utils/download_maps.js";
import { login, config } from "../tabs.js";

export const reader = new OsuReader();
export const files  = new Map();

const get_tournament_maps = async(id) => {

    const response = await axios.get(`https://osucollector.com/api/tournaments/${id}`);
    const data = response.data;

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

const setup_collector = async (url) => {

    const osu_file = files.get("osu");

    if (!login) {
        add_alert("forgot to configurate? :P");
        events.emit("progress-end", task_id);
        console.log("\nPlease restart the script to use this feature\n");
        return;
    }

    // get collection id
    const url_array = url.split("/");
    const collection_id = url_array[url_array.length - 2];

    if (!collection_id) {
        add_alert("invalid URL");
        events.emit("progress-end", task_id);
        return;
    }

    // request collection data from osuCollector api
    const is_tournament = url_array.includes("tournaments");
    const collection_url = `https://osucollector.com/api/collections/${collection_id}`;
    const Rcollection = is_tournament ? await get_tournament_maps(collection_id) : await axios.get(collection_url);
    const collection = is_tournament ? Rcollection : Rcollection.data;

    if (Rcollection.status != 200) {
        add_alert("invalid collection");
        events.emit("progress-end", task_id);
        return;
    }

    if (!collection.beatmapsets) {
        add_alert("Failed to get collection from osu collector");
        events.emit("progress-end", task_id);
        return;
    }

    reader.set_type("osu");
    reader.set_buffer(osu_file, true);

    if (!reader.osu.beatmaps) {
        console.log("reading osu.db file...\n");
        await reader.get_osu_data();
    }

    const maps_hashes = new Set(reader.osu.beatmaps.map((beatmap) => beatmap.md5));
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

const collector_queue = [];
let interval;

const interval_func = async () => {

    if (collector_queue.length == 0) {
        return;
    }

    const queue = collector_queue[0];

    if (queue.status == "wip") {
        return;
    }
    
    if (queue.status == "waiting") {
        console.log("Found a task", queue);
        await queue.init();
    }

    if (queue.status == "finished") {
        console.log("Finished task");
        collector_queue.shift();
    }
};

const init_func = async () => {

    const queue = collector_queue[0];

    const id = queue.id;
    const url = queue.url;

    queue.status = "wip";

    events.emit("progress-update", { id: id, perc: 0 });

    const { maps } = await setup_collector(url);

    await download_maps(maps, id);

    queue.status = "finished";
};

export const download_collector = async (url, task_id) => {

    if (!interval) { 
        interval = setInterval(interval_func, 1000);
    }

    collector_queue.push({ status: "waiting", url: url, init: init_func, id: task_id});
}

export const add_collection = async (url) => {

    const { c_maps, collection } = await setup_collector(url);

    const collection_file = files.get("collection");

    reader.set_type("collection");
    reader.set_buffer(collection_file, true);

    if (reader.collections.length == 0) {
        await reader.get_collections_data();
    }

    reader.collections.beatmaps.push({
        name: "!stuff - " + collection.name,
        maps: c_maps
    });

    reader.collections.length++;

    // backup 
    const backup_name = `collection_backup_${Date.now()}.db`;
    fs.renameSync(path.resolve(config.get("osu_path"), "collection.db"), path.resolve(config.get("osu_path"), backup_name));

    // write the new file
    reader.write_collections_data(path.resolve(config.get("osu_path"), "collection.db"));

    add_alert(`\nYour collection file has been updated!\nA backup file named ${backup_name} has been created in your osu directory\nrename it to collection.db in case the new one is corrupted`);
}