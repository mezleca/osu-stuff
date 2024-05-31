const fs = require("fs");
const path = require("path");

import { reader, files } from "./collector.js";
import { add_alert, add_get_extra_info } from "../popup/alert.js";
import { events } from "../tasks/events.js";
import { config } from "../tabs.js";

const status = {
    "unknown": 0,
    "unsubmitted": 1,
    "pending/wip/graveyard": 2,
    "unused": 3,
    "ranked": 4,
    "approved": 5,
    "qualified":6,
    "loved": 7
}

export const remove_maps = async (id) => {

    try {

        const osu_path = config.get("osu_path");
        const osu_file = files.get("osu");
        
        // initialize for reading osu!.db
        reader.set_type("osu");
        reader.set_directory(osu_path);
        reader.set_buffer(osu_file, true);

        if (!reader.osu.beatmaps) {
            await reader.get_osu_data();
        }

        const type = await add_get_extra_info([{ important: true, type: "list", value: [...Object.keys(status)] }]);
        const stat = status[type];

        if (stat < 0) {
            add_alert("Invalid type", stat);
            events.emit("progress-end", id);
            return;
        }

        console.log("Selected type", type, stat);

        const maps = [];

        for (let i = 0; i < reader.osu.beatmaps.length; i++) {
            
            const map = reader.osu.beatmaps[i];

            if (map.status == stat) {
                maps.push(map);
            }

        }

        const ammout = maps.length;

        if (ammout == 0) {
            add_alert("found 0 maps...");
            events.emit("progress-end", id);
            return;
        }

        let ammount_to_delete = await add_get_extra_info([{ important: true, type: "input", text: `found ${ammout} maps\nhow much do you wanna delete?` }]);

        if (!ammount_to_delete) {
            events.emit("progress-end", id);
            return;
        }

        if (ammount_to_delete > ammout) {
            ammount_to_delete = ammout;
        }

        const confirmation = await add_get_extra_info([{ important: true, type: "confirmation" , text: ` Are you sure? `}]);

        if (confirmation != "Yes") {
            add_alert("ok");
            events.emit("progress-end", id);
            return;
        }

        add_alert("deleting beatmaps in 2 seconds\nthe app may freeze for a while :3");

        // alert the user that shit code will lag everything
        await new Promise(res => setInterval(res, 2000));

        let deleted = 0, failed_to_remove = false;

        const off = [];
        const deleted_folders = [];
        
        reader.osu.beatmaps = reader.osu.beatmaps.filter((b) => {

            if (deleted < ammount_to_delete && b.status == stat) {

                reader.osu.beatmaps_count -= 1;

                const song_path = path.resolve(config.get("osu_songs_path"), b.folder_name);

                console.log(song_path);

                off.push({ start: b.beatmap_start, end: b.beatmap_end});

                if (fs.existsSync(song_path) && !deleted_folders.includes(b.folder_name)) {

                    deleted_folders.push(b.folder_name);
                    reader.osu.folders -= 1;

                    if (!failed_to_remove) {
                        try {
                            fs.rm(song_path, { recursive: true, force: true }, (err) => {
                                if (err) {
                                    console.log(err);
                                    add_alert("Failed to remove osu beatmap due to: no directory permission");
                                    failed_to_remove = true;
                                }
                            });
                        } 
                        catch(err) {
                            console.log(err);
                            add_alert("Failed to remove osu beatmapdue to: no directory permission");
                            failed_to_remove = true;
                        } 
                    }      
                }

                deleted++;
                return false;
            }
            return true;
        });

        if (reader.osu.beatmaps_count < 0) {
            reader.osu.beatmaps_count = 0;
        }

        //fs.renameSync(path.resolve(config.get("osu_path"), "osu!.db"), path.resolve(config.get("osu_path"), "osu!.db.backup_" + String(Date.now())));
        await reader.write_osu_data(off, path.resolve(config.get("osu_path"), "osu!.db"));

        add_alert("done!");

        events.emit("progress-end", id);

    } catch(err) {
        console.error("Removing error", err);
        events.emit("progress-end", id);
    }
};