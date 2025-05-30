import { core } from "../manager/manager.js";
import { create_alert } from "../popup/popup.js";
import { fs, path } from "../utils/global.js";

const deleted_folders = new Set();

export const remove_beatmaps = async (beatmaps) => {

    let failed = false;
    
    for (let i = 0; i < beatmaps.length; i++) {

        try {  

            const item = beatmaps[i];

            const folder_path = path.resolve(core.config.get("stable_songs_path"), item.folder_name);
            const item_path = path.resolve(folder_path, item.file);

            // check if the file exists
            if (fs.existsSync(folder_path)) {

                // remove from the reader so manager wont show the map
                if (core.reader.osu.beatmaps.has(item.md5)) {
                    console.log("[remove beatmaps] removing", item.md5, "from map");
                    core.reader.osu.beatmaps.delete(item.md5);
                } else {
                    console.log("[remove beatmaps] failed to find:", item);
                }

                /// dont remove anything in dev mode
                if (window.process.env.STUFF_ENV == "dev") {
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
                        console.log("[remove beatmaps] removing folder", folder_path);
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

    // make sure we update this otherwise osu will act funny
    update_beatmap_counts(core.reader.osu.beatmaps.size);

    const old_name = path.resolve(core.config.get("stable_path"), "osu!.db");
    const backup_name = path.resolve(core.config.get("stable_path"), `osu!.db.backup_${Date.now()}`);

    // create a backup incase the new one is corrupted
    fs.renameSync(old_name, backup_name);

    await core.reader.write_osu_data(beatmaps.filter((b) => b.beatmap_start != undefined), path.resolve(core.config.get("stable_path"), "osu!.db"));
    return beatmaps.length;
};

const update_beatmap_counts = (size) => {
    const stable_songs_path = core.config.get("stable_songs_path");
    core.reader.osu.folders = fs.readdirSync(stable_songs_path).length;
    core.reader.osu.beatmaps_count = size;
};
