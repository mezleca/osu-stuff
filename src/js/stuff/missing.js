import { message_types, create_alert, create_custom_message } from "../popup/popup.js";
import { search_map_id } from "../utils/download_maps.js";
import { events } from "../events.js";
import { core } from "../utils/config.js";

const fs = window.nodeAPI.fs;
const path = window.nodeAPI.path;

export const export_missing = async (id) => {

    return new Promise(async (resolve, reject) => {
    
        try {
    
            const ids = []; 
            let missing_maps = [];
            
            const Maps = core.reader.collections.beatmaps.map(b => ({ name: b.name, maps: b.maps }));
            
            for (const map of Maps) { // current collection
                for (const m of map.maps) { // each map of the collection
                    if (m && !core.reader.osu.beatmaps.get(m)) {
                        missing_maps.push({ collection_name: map.name, hash: m });
                    }
                }
            }

            const confirm = await create_custom_message({
                type: message_types.MENU,
                title: "Export from a specific collection?",
                items: ["yes", "no"]
            });
    
            if (confirm == null) {
                reject("cancelled");
                return;
            }
    
            if (confirm) {
    
                const collections = [...new Set(missing_maps.map(a => a.collection_name))];
                const obj = [];
        
                for (let i = 0; i < collections.length; i++) {
                    if (collections[i]) {
                        obj.push(collections[i]);
                    }
                }

                const confirm = await create_custom_message({
                    type: message_types.CUSTOM_MENU,
                    title: "select one",
                    elements: [{
                        key: "collection",
                        element: { list: [...obj] }
                    }]
                });
                const name = confirm.collection;
    
                if (!name) {
                    reject("cancelled");
                    return;
                }
        
                missing_maps = missing_maps.filter((a) => { return a.collection_name == name })
        
                if (!missing_maps) {
                    reject("collection not found");
                    return;
                }
    
                console.log("finished checking missing maps");
            }
        
            create_alert("searching beatmap ids\nthis might take a while...");
        
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
        
                console.log("finished beatmap search");

                re();
            });

            const json_path = path.resolve(core.og_path, "exported_beatmaps.json");
        
            await fs.writeFileSync(json_path, JSON.stringify([...new Set(ids)], null , 4));
            await new Promise(resolve => setTimeout(resolve, 500));

            window.electron.open_folder(core.og_path);

            resolve("Finished exporting");
        } 
        catch (err) {
            console.log(`[EXPORT MISSING] Error: ${err}`);
            reject("Something went wrong");
        }
    });
};

export const missing_download = async (id) => {

    return new Promise(async (resolve, reject) => {
    
        try {
    
            let missing_maps = [];

            const Maps = core.reader.collections.beatmaps.map(b => ({ name: b.name, maps: b.maps }));
            
            for (const map of Maps) { // current collection
                for (const m of map.maps) { // each map of the collection
                    if (m && !core.reader.osu.beatmaps.get(m)) {
                        missing_maps.push({ collection_name: map.name, hash: m });
                    }
                }
            }
            
            create_alert(`found ${missing_maps.length} missing maps`);

            const confirm = await create_custom_message({
                type: message_types.MENU,
                title: "Download from a specific collection?",
                items: ["yes", "no"]
            });
    
            if (confirm == null) {
                reject("cancelled");
                return;
            }

            if (confirm == "yes") {
                const collections = [...new Set(missing_maps.map(a => a.collection_name))];
                const obj = [];

                for (let i = 0; i < collections.length; i++) {
                    if (collections[i]) {
                        obj.push(collections[i]);
                    }
                }

                const collection = await create_custom_message({
                    type: message_types.CUSTOM_MENU,
                    title: "select one",
                    elements: [{
                        key: "name",
                        element: { list: [...obj] }
                    }]
                });

                const name = collection.name;

                if (!name) {
                    reject("cancelled");
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
                    reject("collection not found");
                    return;
                }
            }
    
            create_alert(`found: ${missing_maps.length} maps`);
            resolve(missing_maps);
        }
        catch(err) {
            if (err != "cancelled") {
                console.log(`[MISSING DOWNLOAD] Error: ${err}`);
            }
            reject(err == "cancelled" ? "cancelled" : "something went wrong");
        }
    });
};