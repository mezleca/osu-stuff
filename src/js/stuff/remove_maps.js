const fs = require("fs");
const path = require("path");

import { add_alert, add_get_extra_info, createCustomList } from "../popup/alert.js";
import { config, reader, files } from "./utils/config/config.js";

const is_testing = process.env.NODE_ENV == "cleide";

const stats = {
    "all": -1,
    "unknown": 0,
    "unsubmitted": 1,
    "pending/wip/graveyard": 2,
    "unused": 3,
    "ranked": 4,
    "approved": 5,
    "qualified":6,
    "loved": 7
}

const check_difficulty_sr = (map, min, max) => {

    const b = map.sr;

    for (let i = 0; i < b.length; i++) {

        const bm = b[i];

        if (bm.sr.length == 0) {
            return false;                   
        }

        const sr = bm.sr[0][1];

        if (!sr) {
            return false;
        }
 
        if (sr > min && sr < max) {
            return true;
        }
    }

    return false;
};

export const remove_maps = async (id) => {

    return new Promise(async (resolve, reject) => {

        try {

            const areyousure = await add_get_extra_info([{ type: "confirmation", text: "This feature is still experimental\nDo you really want to continue?"}]);

            if (areyousure != "Yes") {
                resolve("");
                return;
            }

            let can_proceed = true;
            let { min_sr, max_sr, status, exclude_collections, sr_enabled } = await createCustomList(Object.keys(stats), id);
    
            status = stats[status];
    
            const off = new Set(), deleted_folders = [], hashes = [], filtered_maps = new Map();
    
            const osu_path = config.get("osu_path");
            const osu_file = files.get("osu");
            const collection_file = files.get("collection");
    
            // read collection
            reader.set_type("collection");
            reader.set_buffer(collection_file, true);
    
            await reader.get_collections_data();
    
            // initialize for reading osu!.db
            reader.set_type("osu");
            reader.set_directory(osu_path);
            reader.set_buffer(osu_file, true);

            await reader.get_osu_data();       
    
            for (let i = 0; i < reader.collections.beatmaps.length; i++) {
    
                const beatmap = reader.collections.beatmaps[i];
    
                for (let j = 0; j < beatmap.maps.length; j++) {
    
                    if (hashes.includes(beatmap.maps[j])) {
                        continue;
                    }
    
                    hashes.push(beatmap.maps[j]);
                }
            }

            // only remove the beatmap if it pass the filter options
            reader.osu.beatmaps.forEach((b) => {
    
                const sp = path.resolve(config.get("osu_songs_path"), b.folder_name);    
                const song_path = path.resolve(config.get("osu_songs_path"), b.folder_name, b.file);
    
                if (b.status != status && status != -1) {
                    filtered_maps.set(b.md5, b);
                    return;
                }
    
                if (hashes.includes(b.md5) && exclude_collections) {
                    filtered_maps.set(b.md5, b);
                    return;
                }
    
                const diff = check_difficulty_sr(b, min_sr, max_sr);
    
                if (!diff && sr_enabled) {
                    filtered_maps.set(b.md5, b.sr);
                    return;
                }
    
                off.add({ sr: b.sr, path: song_path, folder_path: sp, start: b.beatmap_start, end: b.beatmap_end });
            });

            if (off.size == 0) {
                reject("No beatmaps found");
                console.log("No beatmaps found");
                return;
            }
    
            add_alert("Found " + off.size + " beatmaps to delete");
    
            const confirmation = await add_get_extra_info([{ important: true, type: "confirmation" , text: ` Are you sure? `}]);
    
            if (confirmation != "Yes") {
                reject("cancelled");
                return;
            }
    
            add_alert("removing beatmaps...");
    
            reader.osu.beatmaps = filtered_maps;

            off.forEach((item) => {

                try {

                    // dev mode
                    if (is_testing) {
                        return;
                    }
    
                    // check if the folder exists?
                    if (!fs.existsSync(item.path)) {
                        return;
                    }
    
                    // remove the .osu file
                    fs.unlinkSync(item.path);

                    // check if folder has any .osu remaining, if not: remove the folder
                    const folder = fs.readdirSync(item.folder_path);

                    let delete_folder = false;

                    for (let j = 0; j < folder.length; j++) {

                        const folder_item = folder[j];

                        // if theres a .osu file in the folder just break the loop and keep the folder
                        if (folder_item.endsWith(".osu")) {
                            delete_folder = false;
                            break;
                        }

                        // check if we already deleted the folder before
                        if (deleted_folders.includes(item.folder_path)) {
                            break;
                        }

                        delete_folder = true;
                    }

                    if (delete_folder) {

                        // delete the osu beatmap folder
                        fs.rmdirSync(item.folder_path, { recursive: true });
                        deleted_folders.push(item.folder_path);

                        console.log("Deleting folder", item.folder_path);
                    }
    
                } catch(err) {
                    console.error("removing beatmap error", err, item.path);
                    can_proceed = false;
                }     
            });
    
            reader.osu.folders = fs.readdirSync(config.get("osu_songs_path")).length;
            reader.osu.beatmaps_count = filtered_maps.size;
    
            if (reader.osu.beatmaps_count < 0) {
                reader.osu.beatmaps_count = 0;
            }

            if (!can_proceed) {
                reject("Some weird shit happened!!\nPlease report this issue on the osu-stuff repository\n(Make sure to read how to report a issue on the readme)");
                return;
            }
    
            fs.renameSync(path.resolve(config.get("osu_path"), "osu!.db"), path.resolve(config.get("osu_path"), "osu!.db.backup_" + String(Date.now())));
            await reader.write_osu_data(Array.from(off), path.resolve(config.get("osu_path"), "osu!.db"));

            add_alert("Done!\nRemoved " + off.size + " beatmaps");
            resolve("Done!\nRemoved " + off.size + " beatmaps");

        } catch(err) {
            console.error(err);
            reject(err);
        }
    });
};