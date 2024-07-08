const fs = require("fs");
const path = require("path");

import { reader, files } from "./collector.js";
import { add_alert, add_get_extra_info, createCustomList } from "../popup/alert.js";
import { config } from "./utils/config/config.js";

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

            let { min_sr, max_sr, status, exclude_collections, sr_enabled } = await createCustomList(Object.keys(stats), id);
    
            status = stats[status];
    
            const off = [], deleted_folders = [], hashes = [], filtered_maps = [];
    
            const osu_path = config.get("osu_path");
            const osu_file = files.get("osu");
            const collection_file = files.get("collection");
    
            // read collection
            reader.set_type("collection");
            reader.set_buffer(collection_file, true);
    
            if (reader.collections.beatmaps?.length) {
                console.log("no collections", reader.collections);
                await reader.get_collections_data();
            }
    
            // initialize for reading osu!.db
            reader.set_type("osu");
            reader.set_directory(osu_path);
            reader.set_buffer(osu_file, true);
    
            if (!reader.osu.beatmaps?.length) {
                console.log("no beatmaps", reader.osu);
                await reader.get_osu_data();
            }
    
            for (let i = 0; i < reader.collections.beatmaps.length; i++) {
    
                const beatmap = reader.collections.beatmaps[i];
    
                for (let j = 0; j < beatmap.maps.length; j++) {
    
                    if (hashes.includes(beatmap.maps[j])) {
                        continue;
                    }
    
                    hashes.push(beatmap.maps[j]);
                }
            }
    
            for (let i = 0; i < reader.osu.beatmaps_count; i++) {
                
                const b = reader.osu.beatmaps[i];
    
                const sp = path.resolve(config.get("osu_songs_path"), b.folder_name);    
                const song_path = path.resolve(config.get("osu_songs_path"), b.folder_name, b.file);
    
                if (b.status != status && status != -1) {
                    filtered_maps.push(b);
                    continue;
                }
    
                if (hashes.includes(b.md5) && exclude_collections) {
                    filtered_maps.push(b);
                    continue;
                }
    
                const diff = check_difficulty_sr(b, min_sr, max_sr);
    
                if (!diff && sr_enabled) {
                    filtered_maps.push(b.sr);
                    continue;
                }
    
                off.push({ sr: b.sr, path: song_path, folder_path: sp, start: b.beatmap_start, end: b.beatmap_end});
            }
    
            add_alert("Found " + off.length + " beatmaps to delete");
    
            const confirmation = await add_get_extra_info([{ important: true, type: "confirmation" , text: ` Are you sure? `}]);
    
            if (confirmation != "Yes") {
                reject("cancelled");
                return;
            }
    
            add_alert("removing beatmaps...");
    
            reader.osu.beatmaps = filtered_maps;
    
            for (let i = 0; i < off.length; i++) {
    
                try {
    
                    if (!fs.existsSync(off[i].path)) {
                        continue;
                    }

                    if (is_testing) {
                        continue;
                    }
    
                    fs.unlinkSync(off[i].path);
    
                } catch(err) {
                    console.error("removing beatmap error", err, off[i].path);
                }     
            }
    
            for (let i = 0; i < off.length; i++) {
    
                try {
                
                    const folder = fs.readdirSync(off[i].folder_path);
    
                    let has_osu = false;
    
                    for (let j = 0; j < folder.length; j++) {
                        if (folder[j].endsWith(".osu")) {
                            //console.log("found .osu in", off[i].folder_path);
                            has_osu = true;
                            continue;
                        }
                    }
    
                    if (has_osu || deleted_folders.includes(off[i].folder_path)) {
                        continue;
                    }
                    
                    if (is_testing) {
                        continue;
                    }
    
                    fs.rmdirSync(off[i].folder_path, { recursive: true });
    
                    deleted_folders.push(off[i].folder_path);
    
                } catch(err) {
                    console.error("removing folder error", err, off[i].folder_path);
                }
            }
    
            reader.osu.folders = fs.readdirSync(config.get("osu_songs_path")).length;
            reader.osu.beatmaps_count = filtered_maps.length;
    
            if (reader.osu.beatmaps_count < 0) {
                reader.osu.beatmaps_count = 0;
            }
    
            fs.renameSync(path.resolve(config.get("osu_path"), "osu!.db"), path.resolve(config.get("osu_path"), "osu!.db.backup_" + String(Date.now())));
            await reader.write_osu_data(off, path.resolve(config.get("osu_path"), "osu!.db"));
    
            resolve("Done!\nRemoved " + off.length + " beatmaps");

        } catch(err) {
            console.log("Removing error", err);
            reject(err);
        }
    });
};