import { create_custom_popup, create_alert, message_types, quick_confirm } from "../popup/popup.js";
import { core } from "../utils/config.js";
import { fs, path, is_testing } from "../utils/global.js";

// @TODO: rework the filter system

export const beatmap_status = {
    "all": -1,
    "unknown": 0,
    "unsubmitted": 1,
    "pending": 2,
    "unused": 3,
    "ranked": 4,
    "approved": 5,
    "qualified":6,
    "loved": 7
}

// @TODO: other gamemodes support
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

// find beatmaps that match the filter
const find_matching_beatmaps = (min_sr, max_sr, status, ignore_from_collections) => {

    const hashes = new Set(core.reader.collections.beatmaps.flatMap(beatmap => beatmap.maps));
    const matching_maps = new Set();
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

        matching_maps.add({ 
            sr: b.sr, 
            path: song_path, 
            folder_path: sp, 
            start: b.beatmap_start, 
            end: b.beatmap_end 
        });
    }

    return { matching_maps, filtered_maps };
};

// experimental, still not 100% safe
export const delete_beatmaps = async (beatmaps) => {

    const deleted_folders = new Set();
    
    for (const item of beatmaps) {

        try {  

            if (fs.existsSync(item.path)) {

                if (core.reader.osu.beatmaps.has(item.md5)) {
                    core.reader.osu.beatmaps.delete(item.md5);
                } else {
                    console.log("failed to find:", item);
                }

                if (window.electron.dev_mode) {
                    console.log("[dev] skipping delete:", item.folder_path, item.md5);
                    continue;
                }

                fs.unlinkSync(item.path); 
                
                // if the folder has no .osu left, delete everything
                if (!deleted_folders.has(item.folder_path)) {

                    const folder = fs.readdirSync(item.folder_path);
                    
                    console.log("deleting item", item.path);

                    if (!folder.some(file => file.endsWith('.osu'))) {
                        fs.rmdirSync(item.folder_path, { recursive: true });
                        deleted_folders.add(item.folder_path);
                        console.log("deleting folder", item.folder_path);
                    }
                }
            }
        } 
        catch(err) {
            console.error("removing beatmap error", err, item.path);
        }    
    }

    // make sure we update this otherwise osu.db will act funny
    update_beatmap_counts(core.reader.osu.beatmaps.size);

    const old_name = path.resolve(core.config.get("osu_path"), "osu!.db");
    const new_backup_name = path.resolve(core.config.get("osu_path"), `osu!.db.backup_${Date.now()}`);

    if (!window.electron.dev_mode) {
        // backup
        fs.renameSync(old_name, new_backup_name);
        core.reader.write_osu_data(beatmaps, path.resolve(core.config.get("osu_path"), "osu!.db"));
    } else {
        console.log("[dev] skipping save", core.reader.osu.beatmaps);
    }

    return beatmaps.size;
};

const update_beatmap_counts = (size) => {
    const osu_songs_path = core.config.get("osu_songs_path");
    core.reader.osu.folders = fs.readdirSync(osu_songs_path).length;
    core.reader.osu.beatmaps_count = size;
};

// main function
export const remove_maps = async (id) => {

    return new Promise(async (resolve, reject) => {

        try {

            const proc = await quick_confirm("This feature is still experimental\nSo... are you sure?");
            
            if (!proc) {
                return reject("cancelled");
            }
    
            // get filter from user
            const custom_list = [ 
                { key: "star_rating", element: { range: { label: "star rating", min: 0, max: 30 } } },
                { key: "ignore_from_collections", element: { checkbox: { label: "ignore from collections"} } },
                { key: "status", element: { list: { options: Object.keys(beatmap_status) }} }
            ];
    
            const filter_data = await create_custom_popup({
                type: message_types.CUSTOM_MENU,
                title: "menu",
                elements: custom_list
            });
    
            if (!filter_data) {
                return reject("filter_data not provided");
            }
    
            const { star_rating: { min: min_sr, max: max_sr }, status: selected_status, ignore_from_collections } = filter_data;
            const status = beatmap_status[selected_status];
    
            // find matching beatmaps
            const { matching_maps, filtered_maps } = find_matching_beatmaps(min_sr, max_sr, status, ignore_from_collections);
    
            if (matching_maps.size == 0) {
                return reject("found 0 beatmaps ;-;");
            }
    
            create_alert(`found ${matching_maps.size} beatmaps`);
    
            // confirm deletion
            const delete_conf = await create_custom_popup({
                type: message_types.MENU,
                title: "are you sure?",
                items: ["yes", "no"]
            });
            
            if (delete_conf != "yes") {
                return reject("cancelled");
            }
    
            create_alert("removing beatmaps...");
    
            // delete beatmaps and update counts
            await delete_beatmaps(filtered_maps);
    
            create_alert(`removed ${deleted_count} beatmaps`);
            return `removed ${deleted_count} beatmaps`;
        } catch(err) {
            if (typeof err == "string") {
                console.log(err);
            } else if (err.message) {
                console.log(err.message);
            }
        }
    });
};
