const EventEmitter = require("events");

export const events = new EventEmitter();

import { current_tasks, all_tabs, blink, download_types } from "../tabs.js";
import { download_collector } from "../stuff/collector.js"
import { missing_download, export_missing } from "../stuff/missing.js";
import { download_from_json } from "../stuff/download_json.js";
import { add_alert } from "../popup/alert.js";
import { remove_maps } from "../stuff/remove_maps.js";
import { download_from_players } from "../stuff/download_from_players.js";
import { download_maps } from "../stuff/utils/downloader/download_maps.js";

const queue = [];
const all_content = [...document.querySelectorAll(".tab-pane")];

const create_queue_div = () => {

    console.log("[Create Queue] Creating Queue Div");

    const html = 
    `
    <div class="tab-shit download-shit" id="queue list">
        <h1>queue list</h1>
        <div class="queue-list">
            
        </div>
    </div>
    `;

    all_content[3].insertAdjacentHTML("afterbegin", html);
};

const update_queue_div = (id) => {

    const div_exist = document.querySelector(".queue-list");

    if (!div_exist && queue.length != 0) {
        create_queue_div();
    }

    if (queue.length == 0 && div_exist) {
        all_content[3].removeChild(document.getElementById("queue list"));
        return;
    }

    if (queue.length <= 1) {
        return;
    }

    const div = document.querySelector(".queue-list");
    const html = `<h1 class="queue-item" id="${id}">${id}</h1>`;

    div.insertAdjacentHTML("afterbegin", html);
};

const remove_queue_div = (id) => {

    console.log("[Remove Queue] Removing Queue Div", id);

    const div = document.querySelector(`.queue-item[id="${id}"]`);

    if (div) {
        document.querySelector(".queue-list").removeChild(div);
    }
};

// queue interval
setInterval(() => {
   
    if (queue.length == 0) {
        update_queue_div(0);
        return;
    }

    const _queue = queue[0];

    if (_queue.status == "wip") {
        return;
    }

    if (_queue.status == "finished") {
        queue.shift();
        remove_queue_div(_queue.id);
        return;
    }

    download_maps(_queue.list, _queue.id);

    events.emit("progress-update", { id: _queue.id, perc: 0 });

    _queue.dtab.prepend(_queue.tab);
    _queue.status = "wip";

}, 500);

const handle_event = async (data, callback, ...args) => {

    const type = data.type;

    console.log(`[HANDLE EVENT] received event: ${type}`, data);

    try {

        // run the callback and get the value
        const callback_value = await callback(...args);

        console.log("[HANDLE EVENT] callback value", callback_value);
        
        // if theres no value in the callback, it means the function is not part of the: download bullshit
        if ((!callback_value && download_types.includes(type)) || typeof callback_value != "object") {
            // console.log("[HANDLE EVENT] No maps to download");
            current_tasks.delete(data.id);
            return;
        }

        const download_button = all_tabs[3];

        // in case the next task will be a downloadeble one
        // make it blink so the user knows something is happening
        if (download_types.includes(type)) {
            blink(download_button);
        }

        // add the download to the queue
        if (queue.length != 0) {
            add_alert(`Added Download to queue`, { type: "success" });
        }

        queue.push({ type: type, id: data.id, list: callback_value, status: "waiting", dtab: data.dtab, tab: data.tab });

        update_queue_div(data.id);

    } catch(err) {

        current_tasks.delete(data.id);

        if (err == "cancelled" || err == "Cancelled") {
            return;
        }

        console.log(data.type, err);

        add_alert(err, { type: "error" });
    }
}

const test_alerts = async () => {
  
    for (let i = 0; i < 3; i++) {
        add_alert("Popup", i, { seconds: 60 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
};

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
        case "test_popup":
            test_alerts();
            break;
        default:
            add_alert("option not found", { type: "error" });
            break;
    }
});

events.on("progress-update", (data) => {

    const status = current_tasks.get(data.id);

    if (!status) {
        console.log("[PROGRESS-UPDATE] status not found", data.id);
        return;
    }

    const index = data.i || 0;
    const length = !data.l ? "???" : data.l;
    const perc = (index / length) * 100 || 0;

    status.text.innerText = `${index} / ${length} (${perc.toFixed(0)}%)`;
    status.bar.style.width = `${perc}%`;
});

events.on("progress-end", (id, is_download) => {

    console.log("progress-end", id, is_download, current_tasks.get(id));

    const status = current_tasks.get(id).Fdiv;

    if (!status) {
        console.log("[PROGRESS-END] status not found", data.id);
        return;
    }

    if (is_download && queue.length != 0) {
        queue[0].status = "finished";
    }

    if (all_content[3].contains(status)) {
        all_content[3].removeChild(status);
    }

    current_tasks.delete(id);
});