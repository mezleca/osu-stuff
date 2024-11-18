import { tasks, all_tabs, blink, download_types } from "./tabs.js";
import { create_alert, message_types, create_custom_message } from "./popup/popup.js";
import { download_maps, current_download } from "./utils/download_maps.js";

class EventEmitter {

    constructor() {
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, ...args) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(...args));
        }
    }

    remove_listener(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    remove_all_listeners(event) {
        if (event) {
            delete this.listeners[event];
            return;
        }
        this.listeners = {};
    }
}

export const events = new EventEmitter();

const queue = new Map();
const all_content = [...document.querySelectorAll(".tab-pane")];

const start_task = (task) => {

    if (task?.dtab) {

        task.dtab.appendChild(task.tab);
        task.dtab.addEventListener("click", async (ev) => {

            if (ev.target.id != task.id) {
                return;
            }
            
            const confirmation = await create_custom_message({
                type: message_types.MENU,
                title: "press yes to cancel the current download",
                items: ["yes", "no"]
            });

            if (confirmation != "yes") {
                return;
            }

            // if its downloading, stop it
            if (current_download.id == task.id) {          
                current_download.should_stop = true;
                console.log(current_download);
            } else { // or just remove from the queue list
                console.log(current_download, task.id);      
                remove_queue_div(task.id);
            }

            const status = task.tab;
            const data = queue.get(task.id);
        
            data.status = "finished";

            queue.set(task.id, data);
            tasks.delete(task.id);

            // remove download div
            if (status && all_content[2].contains(status)) {
                all_content[2].removeChild(status);
            }

            create_alert("download cancelled");
        });
    }
    
    download_maps(task.list, task.id);

    events.emit("progress-update", { id: task.id, perc: 0 });

    task.status = "wip";
};

const create_queue_div = () => {

    const html = 
    `
    <div class="tab-shit status-shit" id="queue list">
        <h1>queue list</h1>
        <div class="queue-list">
            
        </div>
    </div>
    `;

    all_content[2].insertAdjacentHTML("afterbegin", html);
};

const update_queue_div = (id) => {

    const div_exist = document.querySelector(".queue-list");

    if (!div_exist && queue.size != 0) {
        create_queue_div();
    }

    if (queue.size <= 1) {
        return;
    }

    const div = document.querySelector(".queue-list");
    const html = `<h1 class="queue-item" id="${id}">${id}</h1>`;

    div.insertAdjacentHTML("afterbegin", html);
};

const remove_queue_div = (id) => {
    const div = document.querySelector(`.queue-item[id="${id}"]`);
    if (div) {
        document.querySelector(".queue-list").removeChild(div);
    }
};

// queue interval
setInterval(() => {
   
    if (queue.size == 0) {
        update_queue_div(0);
        return;
    }

    const task = queue.values().next().value;

    if (task.status == "wip") {
        return;
    }

    if (task.status == "finished") {
        queue.delete(task.id);
        remove_queue_div(task.id);
        if (queue.size == 0) {
            all_content[2].removeChild(document.querySelector(".status-shit"));
        }      
        return;
    }

    start_task(task);

}, 500);

export const handle_event = async (data, callback, ...args) => {

    try {

        // run the callback and get the value
        const callback_value = await callback(...args);

        if (callback_value) {        
            console.log("[HANDLE EVENT] callback value", callback_value);
        }
        
        // if theres no value in the callback, it means the function is not part of the: download bullshit
        if ((!callback_value && download_types.includes(data.id)) || typeof callback_value != "object") {
            tasks.delete(data.id);
            return;
        }

        const download_button = all_tabs[2];

        if (download_types.includes(data.id)) {
            blink(download_button);
        }

        // add the download to the queue
        if (queue.size != 0) {
            console.log("adding to the queue");
            create_alert(`Added Download to queue`, { type: "success" });
        }

        queue.set(data.id, { id: data.id, list: callback_value, status: "waiting", tab: data.tab, dtab: data.dtab });

        update_queue_div(data.id);

    } catch(err) {

        tasks.delete(data.id);

        if (String(err).toLowerCase() == "cancelled" || !err) {
            return;
        }

        create_alert(String(err), { type: "error" });
    }
}

events.on("progress-update", (data) => {

    const status = tasks.get(data.id);

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

    const data = tasks.get(id);

    if (!data) {
        console.log("Id not found", data, id);
        return;
    }

    const status = data.tab;

    if (!status) {
        console.log("[PROGRESS-END] status not found", data.id);
        return;
    }

    if (is_download) {
        data.status = "finished";
        queue.set(id, data);
    }

    if (all_content[2].contains(status)) {
        all_content[2].removeChild(status);
    }

    tasks.delete(id);
});