import { create_custom_message, create_alert, message_types } from "../popup/popup.js";
import { core } from "../utils/config.js";

const is_testing = window.electron.dev_mode;

const fs = window.nodeAPI.fs;
const path = window.nodeAPI.path;

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

        const proc = await create_custom_message({
            type: message_types.MENU,
            title: "This feature is still experimental\nSo... are you sure?",
            items: ["yes", "no"]
        });
        
        if (proc != "yes") {
            return "";
        }

        const custom_list = [ 
            { key: "star_rating", element: { range: { min: 0, max: 30 } } },
            { key: "ignore from collections", element: { checkbox: {  } } },
            { key: "status", element: { list: { options: Object.keys(stats) }} }
        ];

        const filter_data = await create_custom_message({
            type: message_types.CUSTOM_MENU,
            title: "menu",
            elements: custom_list
        });

        if (!filter_data) {
            throw new Error("filter_data not provided");
        }

        const { star_rating: { min: min_sr, max: max_sr }, status: selected_status, ignore_from_collections } = filter_data;
        const status = stats[selected_status];

        const hashes = new Set(core.reader.collections.beatmaps.flatMap(beatmap => beatmap.maps));
        const off = new Set();
        const deleted_folders = new Set();
        const filtered_maps = new Map();
        const osu_songs_path = core.config.get("osu_songs_path");

        for (let [k, v] of core.reader.osu.beatmaps) {
            const b = v;
            const sp = path.resolve(osu_songs_path, b.folder_name);    
            const song_path = path.resolve(sp, b.file);

            if ((b.status !== status && status !== -1) || (hashes.has(b.md5) && ignore_from_collections) || !check_difficulty_sr(b, min_sr, max_sr)) {
                filtered_maps.set(b.md5, b);
                continue;
            }

            off.add({ sr: b.sr, path: song_path, folder_path: sp, start: b.beatmap_start, end: b.beatmap_end });
        }

        if (off.size == 0) {
            throw new Error("found 0 beatmaps ;-;");
        }

        create_alert(`found ${off.size} beatmaps`);

        const delete_conf = await create_custom_message({
            type: message_types.MENU,
            title: "are you really sure?",
            items: ["yes", "no"]
        });
        
        if (delete_conf != "yes") {
            throw new Error("cancelled");
        }

        create_alert("removing beatmaps...");

        core.reader.osu.beatmaps = filtered_maps;

        if (!is_testing) {
            for (const item of off) {
                try {  
                    if (fs.existsSync(item.path)) {
                        fs.unlinkSync(item.path); 
                        if (!deleted_folders.has(item.folder_path)) {
                            const folder = fs.readdirSync(item.folder_path);
                            if (!folder.some(file => file.endsWith('.osu'))) {
                                fs.rmdirSync(item.folder_path, { recursive: true });
                                deleted_folders.add(item.folder_path);
                                console.log("deleting folder", item.folder_path);
                            }
                        }
                    }
                } catch(err) {
                    console.error("removing beatmap error", err, item.path);
                }
            }
        }

        core.reader.osu.folders = fs.readdirSync(osu_songs_path).length;
        core.reader.osu.beatmaps_count = Math.max(filtered_maps.size, 0);

        const backup_name = `osu!.db.backup_${Date.now()}`;
        const old_name = path.resolve(core.config.get("osu_path"), "osu!.db");
        const new_backup_name = path.resolve(core.config.get("osu_path"), backup_name);

        await fs.renameSync(old_name, new_backup_name);
        await core.reader.write_osu_data(Array.from(off), path.resolve(core.config.get("osu_path"), "osu!.db"));

        create_alert(`Done!\nRemoved ${off.size} beatmaps`);
        return `Done!\nRemoved ${off.size} beatmaps`;
    } catch(err) {
        console.log(err);
    }
};