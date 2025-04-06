import { tasks, blink, panels, tabs, add_tab } from "../tabs.js";
import { create_alert, message_types, create_custom_popup } from "../popup/popup.js";
import { download_maps, current_download } from "../utils/download_maps.js";
import { events } from "./emitter.js";
import { core } from "../app.js";

export let queue_interval = null;

const download_types = ["get_missing_beatmaps", "get_player_beatmaps", "download_from_json"];
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

            core.progress.update("download cancelled");
        });
    }

    events.emit("progress-update", { id: task.id, perc: 0 });
    task.status = "wip";
    download_maps(task.list, task.id);
};

const manage_queue_ui = {

    create_div() {
        console.log("[queue] creating queue div");
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
    console.log("[queue] disabling interval");
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
        
        if ((!callback_value && download_types.includes(data.id)) || typeof callback_value != "object") {
            tasks.delete(data.id);
            return;
        }

        if (download_types.includes(data.id)) {
            blink(tabs.status);
        }

        if (queue.size != 0) {
            core.progress.update("added download to queue");
        }

        queue.set(data.id, { 
            id: data.id, 
            list: callback_value, 
            status: "waiting", 
            tab: data.tab, 
            dtab: data.dtab 
        });

        if (queue_interval == null) {
            console.log("[event] initializing queue interval");
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
};

export const create_task = async (task_name, ...extra_args) => {

    const new_task = add_tab(task_name);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(task_name, data);
    
    await handle_event(data, ...extra_args);
};

export const create_download_task = async (name, maps) => {

    const new_task = add_tab(name);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(name, data);
    blink(tabs.status);
    
    await handle_event(data, () => { return maps });
};

events.on("progress-update", (data) => {

    const status = tasks.get(data.id);

    if (!status) {
        console.log("[progress] task not found", data, tasks);
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
        console.log("[progress] id not found", data, id);
        return;
    }

    const status = data.tab;

    if (!status) {
        console.log("[progress] status not found", data.id);
        return;
    }

    if (downloaded) {
        data.status = "finished";
        queue.set(id, data);
    }

    if (panels.status.contains(status)) {
        panels.status.removeChild(status);
    } else {
        console.log("[progress] panel dont contain status", status, );
    }

    tasks.delete(id);
});
