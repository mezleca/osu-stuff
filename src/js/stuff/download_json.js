const fs = require("fs");
const path = require("path");

import { add_alert, add_get_extra_info } from "../popup/alert.js";
import { download_maps} from "./utils/download_maps.js";
import { events } from "../tasks/events.js";

let in_progress = false;

const downloaded_maps = [];

export const download_from_json = async (id) => {

    const p = await add_get_extra_info([{ type: "file", text: 'Make sure your json file have this format:\n["https://osu.ppy.sh/beatmapsets/2114717"]\n\nfile'}]);

    if (!p) {
        add_alert("Failed to get file...", { type: "error" });
        events.emit("progress-end", id);
        return;
    }

    if (in_progress) {
        add_alert("There is already a download for json stuff", { type: "warning" });
        events.emit("progress-end", id);
        return;
    }
    
    if (!fs.existsSync(path.resolve(p.path))) {
        add_alert("\nfile not found\n", { type: "error" });
        return;
    }

    in_progress = true;

    const file = fs.readFileSync(path.resolve(p.path), "utf-8");
    const json = JSON.parse(file);

    const ids = [];

    for (let i = 0; i < json.length; i++) {

        const a = json[i].split("/");
        const id = a[a.length - 1];

        if (downloaded_maps.includes(id)) {
            continue;
        }

        if (id) {
            ids.push({ id: id });
        }
    }

    if (ids.length == 0) {
        add_alert("hmm\no maps found in this file ;-;", { type: "error" });
        events.emit("progress-end", id);
        in_progress = false;
        return;
    }

    add_alert("downloading", json.length, "maps...\n");

    await download_maps(ids, id);

    downloaded_maps.push(...ids);

    add_alert("done download from json", { type: "success" });

    in_progress = false;
};