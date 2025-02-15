import { tasks, blink, download_types, panels, tabs } from "./tabs.js";
import { create_alert, message_types, create_custom_popup } from "./popup/popup.js";
import { download_maps, current_download } from "./utils/download_maps.js";

export let queue_interval = null;

class event_emitter {
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

export const events = new event_emitter();
const queue = new Map();

const start_task = (task) => {

    if (task?.dtab) {

        task.dtab.appendChild(task.tab);
        task.dtab.addEventListener("click", async (ev) => {

            if (ev.target.id != task.id) {
                return;
            }
            
            const confirmation = await create_custom_popup({
                type: message_types.MENU,
                title: "press yes to cancel the current download",
                items: ["yes", "no"]
            });

            if (confirmation != "yes") {
                return;
            }

            if (current_download.id == task.id) {          
                current_download.should_stop = true;
            } else {
                remove_queue_div(task.id);
            }

            const data = queue.get(task.id);
            data.status = "finished";
            queue.set(task.id, data);
            tasks.delete(task.id);

            if (task.tab && panels.status.contains(task.tab)) {
                panels.status.removeChild(task.tab);
            }

            create_alert("download cancelled");
        });
    }

    events.emit("progress-update", { id: task.id, perc: 0 });
    task.status = "wip";
    download_maps(task.list, task.id);
};

const manage_queue_ui = {

    create_div() {
        console.log("creating queue div");
        const html = `
            <div class="cool-container status-container" id="queue_list">
                <h1>queue list</h1>
                <div class="queue-list"></div>
            </div>
        `;
        panels.status.insertAdjacentHTML("afterbegin", html);
    },

    update(id) {

        const div_exist = document.querySelector(".queue-list");

        if (!div_exist && queue.size != 0) {
            this.create_div();
        }

        if (queue.size < 1) {
            return;
        }

        const div = document.querySelector(".queue-list");
        const html = `<h1 class="queue-item" id="${id}">${id}</h1>`;

        div.insertAdjacentHTML("afterbegin", html);
    },

    remove(id) {
        const div = document.querySelector(`.queue-item[id="${id}"]`);
        if (div) {
            document.querySelector(".queue-list").removeChild(div);
        }
    }
};

const disable_queue_interval = () => {
    manage_queue_ui.update(0);
    clearInterval(queue_interval);
    queue_interval = null;
    console.log("disabling queue interval");
}

const queue_handler = () => {

    if (queue.size == 0) {
        disable_queue_interval();
        return;
    }

    const task = queue.values().next().value;

    if (task.status == "wip") {
        return;
    }

    if (task.status == "finished") {

        queue.delete(task.id);
        manage_queue_ui.remove(task.id);
        
        if (queue.size == 0) {
            const status_shit = Array.from(panels.status.childNodes)
                .find(node => node.classList && node.classList.contains("status-container"));
            
            if (status_shit) {
                panels.status.removeChild(status_shit);
            }
        }      
        return;
    }

    start_task(task);
};

export const handle_event = async (data, callback, ...args) => {
    try {
        const callback_value = await callback(...args);

        if (callback_value) {        
            console.log("[HANDLE EVENT] callback value", callback_value);
        }
        
        if ((!callback_value && download_types.includes(data.id)) || typeof callback_value != "object") {
            tasks.delete(data.id);
            return;
        }

        if (download_types.includes(data.id)) {
            blink(tabs.status);
        }

        if (queue.size != 0) {
            create_alert("Added Download to queue", { type: "success" });
        }

        queue.set(data.id, { 
            id: data.id, 
            list: callback_value, 
            status: "waiting", 
            tab: data.tab, 
            dtab: data.dtab 
        });

        if (queue_interval == null) {
            console.log("initializing queue interval");
            queue_interval = setInterval(queue_handler, 500);
        }

        manage_queue_ui.update(data.id);
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

events.on("progress-end", (id, downloaded) => {

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

    if (downloaded) {
        data.status = "finished";
        queue.set(id, data);
    }

    if (panels.status.contains(status)) {
        panels.status.removeChild(status);
    } else {
        console.log("panel dont contain status", status, );
    }

    tasks.delete(id);
});