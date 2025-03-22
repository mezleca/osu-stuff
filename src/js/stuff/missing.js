import { message_types, create_alert, create_custom_popup } from "../popup/popup.js";
import { core } from "../utils/config.js";

export const missing_download = async () => {

    return new Promise(async (resolve, reject) => {
    
        try {
    
            let missing_maps = [];

            for (const [k, v] of core.reader.collections.beatmaps) { // current collection
                for (const m of v.maps) { // each map of the collection
                    if (m && !core.reader.osu.beatmaps.get(m)) {
                        missing_maps.push({ collection_name: k, hash: m });
                    }
                }
            }

            console.log("missing beatmaps", missing_maps);
            
            create_alert(`found ${missing_maps.length} missing maps`);

            const confirm = await create_custom_popup({
                type: message_types.MENU,
                title: "download from a specific collection?",
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

                const collection = await create_custom_popup({
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
                console.log(`[missing beatmaps] error: ${err}`);
            }
            reject(err == "cancelled" ? "cancelled" : "something went wrong");
        }
    });
};
