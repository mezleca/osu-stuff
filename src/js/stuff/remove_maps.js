const fs = require("fs");
const path = require("path");

import { reader, files } from "./collector.js";
import { add_alert, add_get_extra_info, createCustomList } from "../popup/alert.js";
import { events } from "../tasks/events.js";
import { config } from "./utils/config.js";

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

    try {

        let failed_to_remove = false;
        let { min_sr, max_sr, status, exclude_collections } = await createCustomList(Object.keys(stats), id);

        status = stats[status];

        const off = [], deleted_folders = [], hashes = [], filtered_maps = [];

        const osu_path = config.get("osu_path");
        const osu_file = files.get("osu");
        const collection_file = files.get("collection");

        // read collection
        reader.set_type("collection");
        reader.set_buffer(collection_file, true);

        if (reader.collections.length == 0) {
            await reader.get_collections_data();
        }

        // initialize for reading osu!.db
        reader.set_type("osu");
        reader.set_directory(osu_path);
        reader.set_buffer(osu_file, true);

        if (!reader.osu.beatmaps) {
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

            if (b.status != status && status != -1) {
                filtered_maps.push(b);
                continue;
            }

            if (hashes.includes(b.md5) && exclude_collections) {
                filtered_maps.push(b);
                continue;
            }

            const diff = check_difficulty_sr(b, min_sr, max_sr);

            if (!diff) {
                filtered_maps.push(b.sr);
                continue;
            }

            const song_path = path.resolve(config.get("osu_songs_path"), b.folder_name);

            off.push({ sr: b.sr, path: song_path, start: b.beatmap_start, end: b.beatmap_end});
        }

        add_alert("Found " + off.length + " beatmaps to delete");

        const confirmation = await add_get_extra_info([{ important: true, type: "confirmation" , text: ` Are you sure? `}]);

        if (confirmation != "Yes") {
            add_alert("ok");
            events.emit("progress-end", id);
            return;
        }

        add_alert("deleting beatmaps in 2 seconds\nthe app may freeze for a while :3");

        // alert the user that shit code will lag everything
        await new Promise(res => setInterval(res, 2000));

        reader.osu.beatmaps = filtered_maps;

        // TODO: something is wrong here, need to fix later.
        // not sure what it is but it makes osu remove that option for refreshing beatmaps, cuz osu tries to read some non existent folder.
        
        for (let i = 0; i < off.length; i++) {

            try {

                if (!fs.existsSync(off[i].path)) {
                    deleted_folders.push(off[i].path);
                    reader.osu.beatmaps_count -= 1;
                    continue;
                }
    
                reader.osu.folders -= 1;
                reader.osu.beatmaps_count -= 1;

                if (failed_to_remove) {
                    continue;
                }

                fs.rmdirSync(off[i].path, { recursive: true, force: true });

            } catch(err) {
                console.error("removing beatmap error", err);
                failed_to_remove = true;
                break;
            }     
        }

        if (reader.osu.beatmaps_count < 0) {
            reader.osu.beatmaps_count = 0;
        }

        fs.renameSync(path.resolve(config.get("osu_path"), "osu!.db"), path.resolve(config.get("osu_path"), "osu!.db.backup_" + String(Date.now())));
        await reader.write_osu_data(off, path.resolve(config.get("osu_path"), "osu!.db"));

        add_alert("done!");

        events.emit("progress-end", id);

    } catch(err) {
        console.error("Removing error", err);
        events.emit("progress-end", id);
    }
};