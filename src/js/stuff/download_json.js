const fs = require("fs");
const path = require("path");

import { add_get_extra_info } from "../popup/alert.js";

let in_progress = false;

const downloaded_maps = [];

export const download_from_json = (id) => {

    return new Promise(async (resolve, reject) => {

        const p = await add_get_extra_info([{ type: "file", text: 'Make sure your json file have this format:\n["https://osu.ppy.sh/beatmapsets/2114717"]\n\nfile'}]);

        if (!p) {
            reject("cancelled");
            return;
        }

        if (!fs.existsSync(path.resolve(p.path))) {
            reject("file not found");
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
            reject("no maps found");
            return;
        }

        resolve("finished download maps form json");
    });
};