import { add_alert, add_get_extra_info } from "../popup/popup.js";
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

            console.log("missing maps", missing_maps);
    
            const confirm = await add_get_extra_info([{ type: "confirmation", text: "Export from a specific collection?" }]);
    
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
        
                const name = await add_get_extra_info([{ type: "list", value: [...obj], title: "Select a collection" }]);
    
                if (name == null) {
                    reject("cancelled");
                    return;
                }
        
                missing_maps = missing_maps.filter((a) => { return a.collection_name == name })
        
                if (!missing_maps) {
                    reject("collection not found");
                    return;
                }
    
                console.log("Done finding missing maps");
            }
        
            add_alert("searching beatmap ids\nthis might take a while...");
        
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
        
                console.log("Done searching beatmap ids");

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
            
            add_alert(`found ${missing_maps.length} missing maps`);
    
            const confirm = await add_get_extra_info([{ type: "confirmation", text: "Download from a specific collection?" }]);
    
            if (confirm == null) {
                reject("Cancelled");
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
    
                const name = await add_get_extra_info([{ type: "list", value: [...obj] }]);
    
                if (!name) {
                    reject("Cancelled");
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
                
                add_alert("Found:", missing_maps.length, "maps");
            }
    
            resolve(missing_maps);
        }
        catch(err) {
            console.log(`[MISSING DOWNLOAD] Error: ${err}`);
            reject("Something went wrong");
        }
    });
};