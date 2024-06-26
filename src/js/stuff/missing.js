const fs = require("fs");
const path = require("path");

import { reader, files } from "./collector.js";
import { add_alert, add_get_extra_info } from "../popup/alert.js";
import { download_maps, search_map_id } from "./utils/download_maps.js";
import { events } from "../tasks/events.js";
import { config, og_path } from "./utils/config.js";
import { open_og_folder } from "./utils/process.js";

const downloaded_maps = [];

let in_progress = false;

export const export_missing = async (id) => {

    if (in_progress) {
        add_alert("There is already a download for missing stuff");
        events.emit("progress-end", id);
        return;
    }

    in_progress = true;

    try {

        add_alert("started beatmap export");

        const ids = [];

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

        const confirm = await add_get_extra_info([{ type: "confirmation", text: "Export from a specific collection?" }]);

        if (confirm == null) {
            add_alert("Cancelled", { type: "error" });
            events.emit("progress-end", id);
            in_progress = false
            return;
        }

        if (confirm == "Yes") {

            const collections = [...new Set(missing_maps.map(a => a.collection_name))];
            const obj = [];
    
            for (let i = 0; i < collections.length; i++) {
                if (collections[i]) {
                    obj.push(collections[i]);
                }
            }
    
            const name = await add_get_extra_info([{ type: "list", value: [...obj] }]);

            if (name == null) {
                events.emit("progress-end", id);
                add_alert("Cancelled", { type: "error" });
                in_progress = false
                return;
            }
    
            missing_maps = missing_maps.filter((a) => { return a.collection_name == name })
    
            if (!missing_maps) {
                add_alert("collection not found.", { type: "error" });
                return;
            }

            console.log("Done finding missing maps");
        }
    
        console.log("\nsearching beatmap id's... ( this might take a while )");
    
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

                events.emit("progress-update", { id: id, perc: (i / missing_maps.length * 100), i: i, l: missing_maps.length });
            }
    
            re();
        });
    
        // remove duplicate maps.
        const o = [...new Set(ids)];
    
        fs.writeFileSync(path.resolve(og_path, "exported_beatmaps.json"), JSON.stringify(o, null , 4));

        open_og_folder();
    
        add_alert("finished export", { type: "success" });
        
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
        add_alert("There is already a download for missing stuff", { type: "warning" });
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

        // initialize for reading collection.db
        reader.set_type("collection");
        reader.set_buffer(collection_file, true);

        if (reader.collections.length == 0) {
            await reader.get_collections_data();
        }
        
        const hashes = reader.osu.beatmaps.map(b => b.md5);
        const Maps = reader.collections.beatmaps.map((b) => { return { name: b.name, maps: b.maps } });
        const missing_hashes = new Map();

        // verify things
        for (const map of Maps) {

            for (const m of map.maps) {
                
                if (!m) {
                    continue;
                }

                if (hashes.includes(m)) {
                    continue;
                }

                if (m != "4294967295" && !missing_hashes.has(m) && !downloaded_maps.includes(m)) {
                    missing_hashes.set(m, map.name);
                }

            }
        }

        for (const [key, value] of missing_hashes) {
            missing_maps.push({ hash: key, collection_name: value });
        }
        
        add_alert(`found ${missing_maps.length} missing maps`);

        const confirm = await add_get_extra_info([{ type: "confirmation", text: "Download from a specific collection?" }]);

        // TODO: a better way to cancel the task

        if (confirm == null) {
            add_alert("Cancelled");
            events.emit("progress-end", id);
            in_progress = false
            return;
        }

        if (confirm == "Yes") {

            const collections = [...new Set(missing_maps.map(a => a.collection_name))];
            const obj = [];

            for (let i = 0; i < collections.length; i++) {
                if (collections[i]) {
                    obj.push(collections[i]);
                }
            }

            const name = await add_get_extra_info([{ type: "list", value: [...obj] }]);

            if (!name) {
                add_alert("Cancelled");
                events.emit("progress-end", id);
                in_progress = false
                return;
            }

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

        for (const map of missing_maps) {

            if (downloaded_maps.includes(map.hash)) {
                continue;
            }

            downloaded_maps.push(map.hash);
        }

        in_progress = false;
    }
    catch(err) {
        console.log("Fucking error:\n", err);
        in_progress = false;
        events.emit("progress-end", id);
    }
};