const EventEmitter = require("events");

export const events = new EventEmitter();

import { current_tasks } from "../tabs.js";
import { download_collector } from "../stuff/collector.js"
import { missing_download, export_missing } from "../stuff/missing.js";
import { download_from_json } from "../stuff/download_json.js";
import { add_alert } from "../popup/alert.js";
import { remove_maps } from "../stuff/remove_maps.js";
import { download_from_players } from "../stuff/download_from_players.js";
import { download_maps } from "../stuff/utils/downloader/download_maps.js";

const queue = [];
const all_content = [...document.querySelectorAll(".tab-pane")];

// queue interval
setInterval(() => {
   
    if (queue.length == 0) {
        return;
    }

    const _queue = queue[0];

    if (_queue.status == "wip") {
        console.log("Theres a download in progress", queue);
        return;
    }

    if (_queue.status == "finished") {
        queue.shift();
        return;
    }

    download_maps(_queue.list, _queue.id);

    events.emit("progress-update", { id: _queue.id, perc: 0 });

    _queue.dtab.appendChild(_queue.tab);
    _queue.status = "wip";
}, 500);

// this code looks ass but it works so fuck it
const handle_event = async (data, callback, ...args) => {

    const type = data.type;
    const download_types = ["collector", "missing", "download_from_players", "json"];

    if (download_types.includes(type)) {

        await callback(...args)
            .then((list) => {

                console.log("list value", list);
            
                if (!list) {
                    console.log("No maps to download");
                    current_tasks.delete(data.id);
                    return;
                }

                if (queue.length != 0) {
                    add_alert(`Added Download to queue`, { type: "success" });
                }

                queue.push({ type: type, id: data.id, list: list, status: "waiting", dtab: data.dtab, tab: data.tab });
            })
            .catch((msg) => {

                current_tasks.delete(data.id);

                if (msg == "cancelled") {
                    return;
                }

                add_alert(msg, { type: "error" });
            });

        return;
    }

    callback(...args)
        .then((msg) => {
            current_tasks.delete(data.id);
            console.log("finished", data.id);
            add_alert(msg, { type: "success" });
        })
        .catch((msg) => {

            current_tasks.delete(data.id);
            console.log("error", msg, data.id);

            if (msg == "cancelled") {
                return;
            }

            add_alert(msg, { type: "error" });
        });
}

events.on("task-start", async (data) => {

    const option = data.type;
    
    switch (option) {
        case "collector":
            await handle_event(data, download_collector, data.id, data.url);
            break;
        case "missing":
            await handle_event(data, missing_download, data.id);
            break;
        case "export_missing":
            await handle_event(data, export_missing, data.id);
            break;
        case "json":
            await handle_event(data, download_from_json, data.id);
            break;
        case "remove_maps":
            await handle_event(data, remove_maps, data.id);
            break;
        case "download_from_players":
            await handle_event(data, download_from_players, data.id);
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

events.on("progress-end", (id, is_download) => {

    console.log("progress-end", id, is_download, current_tasks.get(id));

    const status = current_tasks.get(id).Fdiv;

    if (!status) {
        console.log("oops");
        return;
    }

    if (is_download && queue.length != 0) {
        queue[0].status = "finished";
    }

    if (all_content[2].contains(status)) {
        all_content[2].removeChild(status);
    }

    current_tasks.delete(id);
});