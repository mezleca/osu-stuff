const EventEmitter = require("events");

export const events = new EventEmitter();

import { current_tasks } from "../tabs.js";
import { download_collector } from "../stuff/collector.js"
import { missing_download, export_missing } from "../stuff/missing.js";

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
    }
});

events.on("progress-update", (data) => {

    const status = current_tasks.get(data.id);

    if (!status) {
        console.log("oops");
        return;
    }

    status.bar.style.width = `${data.perc}%`;
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