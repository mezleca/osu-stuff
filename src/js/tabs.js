import { handle_event } from "./events.js";
import { create_alert } from "./popup/popup.js";

export const all_tabs = [...document.querySelectorAll(".tab-button")];
export const all_panels = [...document.querySelectorAll(".tab-panel")];
export const sidebar_item = [...document.querySelectorAll(".sidebar-item")];

export const tabs = {
    manager: all_tabs[0], config: all_tabs[1], status: all_tabs[2]
}

export const panels = {
    manager: all_panels[0], config: all_panels[1], status: all_panels[2]
};

export const tasks = new Map();
export const download_types = ["get_missing_beatmaps", "get_player_beatmaps", "download_from_json"];

all_tabs.map((tab, i) => {

    tab.addEventListener("click", (e) => {
        
        const already_active = tab.className == "active";

        if (already_active) {
            return;
        }

        all_tabs.forEach((t) => { t.classList.remove("active") });
        all_panels.forEach((t) => { t.classList.remove("active") });
        all_panels[i].classList.add("active");

        tab.classList.add("active");
    });
});

export const get_current_tab = () => {
    for (let i = 0; i < all_tabs.length; i++) {
        if (all_tabs[i].classList.contains("active")) {
            return all_panels[i].id;
        }
    }
    return null;
};

export const blink = (tab) => {
    tab.style = "animation: blinker 1s linear infinite;";
    tab.addEventListener("click", () => {
        tab.style = "";
        tab.removeEventListener("click", () => {});
    });
};

export const add_tab = (id) => {

    const d_tab = document.getElementById("download_tab");

    if (!id) {
        create_alert("Missing id", { type: "error" });
        return null;
    }

    if (tasks.has(id)) {
        create_alert("theres already a download for this task", { type: "warning" });
        return null;
    }

    const template_str = `
        <div class="cool-container download-shit" id="${id}">
            <h1 id="${id}">${id}</h1>
            <h2>waiting to start</h2>
            <div style="height: 1.5em; background-color: rgb(50, 120, 200); width: 0%; max-width: 100%;"></div>
        </div>
    `;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = template_str.trim();

    const tab = wrapper.firstElementChild;
    const text = tab.querySelector("h2");
    const bar = tab.querySelector("div");

    return { tab, text, dtab: d_tab, bar, id };
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