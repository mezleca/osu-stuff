import { create_custom_popup, create_alert, message_types, quick_confirm } from "../popup/popup.js";
import { core } from "../utils/config.js";
import { fs, path } from "../utils/global.js";

// @TODO: rework the filter system

const deleted_folders = new Set();

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

// @TODO: surely theres a better way to do this
export const beatmap_status_reversed = {
    "-1": "all",
    "0": "unknown",
    "1": "unsubmitted",
    "2": "pending", 
    "3": "unused",
    "4": "ranked",
    "5": "approved",
    "6": "qualified",
    "7": "loved"
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

export const delete_beatmaps = async (beatmaps) => {

    let failed = false;
    
    for (let i = 0; i < beatmaps.length; i++) {

        try {  

            const item = beatmaps[i];

            const folder_path = path.resolve(core.config.get("osu_songs_path"), item.folder_name);
            const item_path = path.resolve(folder_path, item.file);

            // check if the file exists
            if (fs.existsSync(folder_path)) {

                // remove from the reader so manager wont show the map
                if (core.reader.osu.beatmaps.has(item.md5)) {
                    console.log("[Delete Beatmaps] removing", item.md5, "from map");
                    core.reader.osu.beatmaps.delete(item.md5);
                } else {
                    console.log("[Delete Beatmaps] failed to find:", item);
                }

                /// dont remove anything in dev mode
                if (window.electron.dev_mode) {
                    console.log("[dev] skipping delete:", folder_path, item.md5);
                    continue;
                }

                fs.unlinkSync(item_path); 
                
                // check if we already deleted this folder
                if (!deleted_folders.has(folder_path)) {

                    // read folder content and if no .osu exists in that folder, remove everything
                    const folder = fs.readdirSync(folder_path);

                    if (!folder.some(file => file.endsWith('.osu'))) {
                        fs.rmdirSync(folder_path, { recursive: true });
                        deleted_folders.add(folder_path);
                        console.log("[Delete Beatmaps] deleting folder", folder_path);
                    }
                }
            }
        } 
        catch(err) {
            failed = true;
            console.error("removing beatmap error", err);
        }    
    }

    // if something went wrong, dont do anything
    if (failed) {
        create_alert("failed to remove beatmaps\ncheck logs for more info");
        return null;
    }

    // make sure we update this otherwise osu.db will act funny
    update_beatmap_counts(core.reader.osu.beatmaps.size);

    const old_name = path.resolve(core.config.get("osu_path"), "osu!.db");
    const backup_name = path.resolve(core.config.get("osu_path"), `osu!.db.backup_${Date.now()}`);

    // create a backup incase the new one is corrupted
    fs.renameSync(old_name, backup_name);
    await core.reader.write_osu_data(beatmaps, path.resolve(core.config.get("osu_path"), "osu!.db"));

    return beatmaps.length;
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
            const delete_conf = await quick_confirm("are you sure?");
            
            if (!delete_conf) {
                return reject("cancelled");
            }
    
            create_alert("removing beatmaps...");
    
            // delete beatmaps
            const count = await delete_beatmaps(filtered_maps);

            // make sure we update this otherwise osu.db will act funny
            update_beatmap_counts(core.reader.osu.beatmaps.size);
    
            create_alert(`removed ${count} beatmaps`);
            return `removed ${count} beatmaps`;
        } catch(err) {
            if (typeof err == "string") {
                console.log(`[Delete Beatmaps] ${err}`);
            } else if (err.message) {
                console.log(`[Delete Beatmaps] ${err.message}`);
            }
        }
    });
};
