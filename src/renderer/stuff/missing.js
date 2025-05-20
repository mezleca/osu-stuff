import { core } from "../manager/manager.js";
import { create_alert, create_custom_popup, message_types } from "../popup/popup.js";
import { downloader } from "../utils/downloader/client.js";

export const get_missing_beatmaps = (id) => {

    const collection = core.reader.collections.beatmaps.get(id);

    if (!collection) {
        create_alert("failed to get collection", id);
        return [];
    }

    const beatmaps = [];

    // check if we have any matching hash on our osu db file
    for (const m of collection.maps) {
        if (m && !core.reader.osu.beatmaps.get(m)) {
            beatmaps.push({ collection_name: id, md5: m });
        }
    }

    return beatmaps;
};

export const download_missing_beatmaps = (id, beatmaps) => {

    if (!core.login?.access_token) {
        create_alert("no osu_id / secret configured :c", { type: "error" });
        return;
    }

    // add to downloader queue
    downloader.create_download({ id: crypto.randomUUID(), name: id, maps: beatmaps });
};

// function to use on get missing beatmaps
export const show_missing_beatmaps = async () => {

    const collections = new Map();

    for (const [k, _] of core.reader.collections.beatmaps) {

        const beatmaps = get_missing_beatmaps(k);

        if (beatmaps.length == 0) {
            continue;
        }

        collections.set(k, beatmaps.map((b) => b.md5));
    }

    const selected = await create_custom_popup({
        type: message_types.CUSTOM_MENU,
        title: "collections to download",
        elements: [
            { 
                key: "collections",
                element: { 
                    cards: Array.from(collections).map(([k, v]) => {
                        return {
                            selectable: true,
                            name: k,
                            count: v.length
                        }
                    })
                }
            }
        ]
    });

    if (selected == null || selected?.collections.length == 0) {
        return;
    }

    // get only the selected collections
    const selected_collections = Array.from(collections).filter((c) => selected.collections.includes(c[0]));
    const beatmaps = [], added = [];

    // create a new array of unique hashes to download
    for (const [_, hashes] of selected_collections) {

        for (const md5 of hashes) {
            
            if (added.includes(md5)) {
                continue;
            }

            beatmaps.push({ md5: md5 });
            added.push(md5);
        }
    }

    // add a new downloaded to queue
    downloader.create_download({ id: crypto.randomUUID(), name: "missing beatmaps", maps: beatmaps});
};