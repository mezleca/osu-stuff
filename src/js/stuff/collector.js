import { events } from "../events/emitter.js";
import { create_alert } from "../popup/popup.js";
import { core } from "../utils/config.js";
import { url_is_valid } from "./download_from_players.js";
import { initialize } from "../manager/manager.js";
import { fs, path, is_testing, collections } from "../utils/global.js";

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
    
    console.log(`[Collector] fetching collection ${collection_id}...`);
    
    const response = is_tournament ? await get_tournament_maps(collection_id) : await fetch(api_url);
    const collection_data = is_tournament ? response : await response.json();

    if (response.status != 200 || !collection_data.beatmapsets) {
        create_alert("failed to get collection", { type: "error" });
        return null;
    }

    const get_hashes = is_tournament ? beatmapsets => beatmapsets.map(b => b.checksum) : beatmapsets => beatmapsets.flatMap(b => b.beatmaps.map(map => map.checksum));

    const existing_map_hashes = new Set(core.reader.osu.beatmaps.keys());
    const collection_hashes = [...new Set(get_hashes(collection_data.beatmapsets))];

    const new_maps = is_tournament
        ? collection_data.beatmapsets
            .filter(beatmap => !existing_map_hashes.has(beatmap.checksum) && beatmap.checksum && beatmap.beatmapset)
            .map(b => b.beatmapset)
        : collection_data.beatmapsets
            .filter(beatmapset => !beatmapset.beatmaps.some(beatmap => existing_map_hashes.has(beatmap.checksum)));

    return {
        maps: new_maps,
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
    
        // make sure c_maps is valid
        const maps = c_maps.filter((m) => m != undefined && typeof m == "string");

        // create a new collection
        core.reader.collections.beatmaps.push({
            name: new_name,
            maps: maps
        });
    
        core.reader.collections.length = core.reader.collections.beatmaps.length;

        console.log("[Collector] updated collections object", core.reader.collections);

        // update the manager
        collections.set(new_name, maps.map((v) => {
            return { md5: v };
        }));
    
        if (is_testing) {
            create_alert("Your collection file has been updated!");
            resolve(`Your collection file has been updated!`);
            return;
        }
    
        // backup 
        const backup_name = `collection_backup_${Date.now()}.db`;
        const old_name = await path.resolve(core.config.get("osu_path"), "collection.db"), 
              new_backup_name = await path.resolve(core.config.get("osu_path"), backup_name);

        await fs.renameSync(old_name, new_backup_name);

        // write the new file
        await core.reader.write_collections_data(path.resolve(core.config.get("osu_path"), "collection.db"));
    
        // update manager
        await initialize({ force: true });

        create_alert("Your collection file has been updated!");
        resolve(`Your collection file has been updated!`);
    });  
}
