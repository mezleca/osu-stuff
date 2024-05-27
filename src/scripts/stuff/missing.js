const fs = require("fs");
const path = require("path");

import { reader, files } from "./collector.js";
import { add_alert, add_get_extra_info } from "../popup/alert.js";
import { download_maps, search_map_id } from "./utils/download_maps.js";
import { events } from "../tasks/events.js";
import { config } from "../tabs.js";

let in_progress = false;

export const export_missing = async (id) => {

    if (in_progress) {
        add_alert("There is already a download for missing stuff");
        events.emit("progress-end", id);
        return;
    }

    in_progress = true;

    try {

        add_alert("started task export beatmaps");

        const osu_path = config.get("osu_path");
        const osu_file = files.get("osu");
        const collection_file = files.get("collection");

        let missing_maps = [];

        // check if data folder exists
        if (!fs.existsSync("./data/")) {
            fs.mkdirSync("./data/");
        }
        
        // initialize for reading osu!.db
        reader.set_type("osu");
        reader.set_directory(osu_path);
        reader.set_buffer(osu_file, true);

        if (!reader.osu.beatmaps) {
            await reader.get_osu_data();
        }
        
        // only the hash/id will be used
        reader.osu.beatmaps.map((b, i) => {
            reader.osu.beatmaps[i] = { hash: b.md5, id: b.beatmap_id };
        });

        // initialize for reading collection.db
        reader.set_type("collection");
        reader.set_buffer(collection_file, true);

        if (reader.collections.length == 0) {
            await reader.get_collections_data();
        }
        
        const hashes = new Set(reader.osu.beatmaps.map(b => b.hash));
        const Maps = reader.collections.beatmaps.map((b) => { return { name: b.name, maps: b.maps } });

        // verify things
        for (const map of Maps) {

            for (const m of map.maps) {
                
                if (!m) {
                    continue;
                }

                if (hashes.has(m)) {
                    continue;
                }

                if (m != "4294967295") {
                    missing_maps.push({ collection_name: map.name, hash: m });
                }

            }
        }

        console.log("Done verifying missing maps");

        if (await add_get_extra_info([{ important: true, type: "confirmation", text: "Export from a specific collection?" }]) == "Yes") {

            const collections = [...new Set(missing_maps.map(a => a.collection_name))];
            const obj = [];
    
            for (let i = 0; i < collections.length; i++) {
                if (collections[i]) {
                    obj.push(collections[i]);
                }
            }
    
            const name = await add_get_extra_info([{ important: true, type: "list", value: [...obj] }])
    
            missing_maps = missing_maps.filter((a) => { return a.collection_name == name })
    
            if (!missing_maps) {
                add_alert("collection not found.");
                return;
            }
            
            add_alert("Found:", missing_maps.length, "missing maps");
        }
    
        console.log("\nsearching beatmap id's... ( this might take a while )");

        const ids = [];
    
        await new Promise(async (re) => {
    
            for (let i = 0; i < missing_maps.length; i++) {
    
                const map = missing_maps[i];     
                const hash = map.hash;
                const info = await search_map_id(hash);   
    
                if (info == null) {
                    continue;
                }
                
                if (info.beatmapset_id) {
                    ids.push(`https://osu.ppy.sh/beatmapsets/${info.beatmapset_id}`);
                }

                events.emit("progress-update", { id: id, perc: (i / missing_maps.length * 100)})
            }
    
            re();
        });
    
        // remove duplicate maps.
        const o = [...new Set(ids)];
    
        fs.writeFileSync(path.resolve("./data/beatmaps.json"), JSON.stringify(o, null , 4));
    
        add_alert("Done\nbeatmaps.json file has been created in the data folder\n");
        
        events.emit("progress-end", id);
    } 
    catch (err) {
        console.log("Fucking error:\n", err);
        in_progress = false;
        events.emit("progress-end", id);
    }
};

export const missing_download = async (id) => {

    if (in_progress) {
        add_alert("There is already a download for missing stuff");
        events.emit("progress-end", id);
        return;
    }

    in_progress = true;

    try {

        const osu_path = config.get("osu_path");
        const osu_file = files.get("osu");
        const collection_file = files.get("collection");

        let missing_maps = [];

        // check if data folder exists
        if (!fs.existsSync("./data/")) {
            fs.mkdirSync("./data/");
        }
        
        // initialize for reading osu!.db
        reader.set_type("osu");
        reader.set_directory(osu_path);
        reader.set_buffer(osu_file, true);

        if (!reader.osu.beatmaps) {
            await reader.get_osu_data();
        }
        
        // only the hash/id will be used
        reader.osu.beatmaps.map((b, i) => {
            reader.osu.beatmaps[i] = { hash: b.md5, id: b.beatmap_id };
        });

        // initialize for reading collection.db
        reader.set_type("collection");
        reader.set_buffer(collection_file, true);

        if (reader.collections.length == 0) {
            await reader.get_collections_data();
        }
        
        const hashes = new Set(reader.osu.beatmaps.map(b => b.hash));
        const Maps = reader.collections.beatmaps.map((b) => { return { name: b.name, maps: b.maps } });

        // verify things
        for (const map of Maps) {

            for (const m of map.maps) {
                
                if (!m) {
                    continue;
                }

                if (hashes.has(m)) {
                    continue;
                }

                if (m != "4294967295") {
                    missing_maps.push({ collection_name: map.name, hash: m });
                }

            }
        }

        console.log(`found ${missing_maps.length} missing maps`);

        if (await add_get_extra_info([{ important: true, type: "confirmation", text: "Download from a specific collection?" }]) == "Yes") {

            const collections = [...new Set(missing_maps.map(a => a.collection_name))];
            const obj = [];

            for (let i = 0; i < collections.length; i++) {
                if (collections[i]) {
                    obj.push(collections[i]);
                }
            }

            const name = await add_get_extra_info([{ important: true, type: "list", value: [...obj] }])
            const abc = missing_maps;

            missing_maps = [];

            for (let i = 0; i < abc.length; i++) {
                
                if (abc[i].collection_name != name || !abc[i].hash) {
                    continue;
                }

                missing_maps.push(abc[i]);
            }

            if (!missing_maps) {
                console.log("collection not found.");
                return;
            }
            
            add_alert("Found:", missing_maps.length, "maps");
        }

        await download_maps(missing_maps, id);

        in_progress = false;
    }
    catch(err) {
        console.log("Fucking error:\n", err);
        in_progress = false;
        events.emit("progress-end", id);
    }
};