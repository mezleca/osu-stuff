import { core } from "../app.js";
import { message_types, create_alert, create_custom_popup } from "../popup/popup.js";
import { downloader } from "../utils/downloader/client.js";

export const missing_download = async () => {

    try {

        let missing_maps = [];

        for (const [k, v] of core.reader.collections.beatmaps) {
            for (const m of v.maps) {
                if (m && !core.reader.osu.beatmaps.get(m)) {
                    missing_maps.push({ collection_name: k, checksum: m });
                }
            }
        }
        
        create_alert(`found ${missing_maps.length} missing maps`);

        const confirm = await create_custom_popup({
            type: message_types.MENU,
            title: "download from a specific collection?",
            items: ["yes", "no"]
        });

        if (confirm == null) {
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
                return;
            }

            missing_maps = missing_maps.filter((c) => c.collection_name == name);

            if (!missing_maps) {
                return;
            }
        }

        if (!core.login?.access_token) {
            create_alert("no osu_id / secret configured :c", { type: "error" });
            return;
        }

        // add to downloader queue
        downloader.create_download({ id: crypto.randomUUID(), name: "missing beatmaps", maps: missing_maps });
    }
    catch(err) {
        console.log(`[missing beatmaps] error: ${err}`);
    }
};
