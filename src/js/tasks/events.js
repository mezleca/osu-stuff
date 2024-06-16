const EventEmitter = require("events");

export const events = new EventEmitter();

import { current_tasks } from "../tabs.js";
import { download_collector } from "../stuff/collector.js"
import { missing_download, export_missing } from "../stuff/missing.js";
import { download_from_json } from "../stuff/download_json.js";
import { add_alert } from "../popup/alert.js";
import { remove_maps } from "../stuff/remove_maps.js";
import { download_from_players } from "../stuff/download_from_players.js";

const all_content = [...document.querySelectorAll(".tab-pane")];

events.on("task-start", (data) => {

    const option = data.type;

    switch (option) {
        case "collector":
            download_collector(data.id, data.url)
            break;
        case "missing":
            missing_download(data.id);
            break;
        case "export_missing":
            export_missing(data.id);
            break;
        case "json":
            download_from_json(data.id);
            break;
        case "remove_maps":
            remove_maps(data.id);
            break;
        case "download_from_players":
            download_from_players(data.id);
            break;
        default:
            add_alert("option not found", { type: "error" });
            break;
    }
});

events.on("progress-update", (data) => {

    const status = current_tasks.get(data.id);

    if (!status) {
        console.log("oops");
        return;
    }

    const index = data.i || 0;
    const length = data.l || 0;
    const perc = (index / length) * 100 || 0;

    status.text.innerText = `${index} / ${length} (${perc.toFixed(0)}%)`;
    status.bar.style.width = `${perc}%`;
});

events.on("progress-end", (id) => {

    const status = current_tasks.get(id).Fdiv;

    if (!status) {
        console.log("oops");
        return;
    }

    all_content[2].removeChild(status);
    current_tasks.delete(id);
});