import { handle_event } from "./events.js";
import { create_alert, create_custom_message, message_types } from "./popup/popup.js";
import { core } from "./utils/config.js";
import { remove_maps } from "./stuff/remove_maps.js";
import { missing_download } from "./stuff/missing.js";
import { download_from_players } from "./stuff/download_from_players.js";

export const all_tabs = [...document.querySelectorAll(".tab-button")];
export const all_panels = [...document.querySelectorAll(".tab-pane")];
export const sidebar_item = [...document.querySelectorAll(".sidebar-item")];
export const general_btn = document.querySelector(".manager-general");
export const other_btn = document.querySelector(".manager-other");

export const tabs = {
    manager: all_tabs[0], config: all_tabs[1], status: all_tabs[2]
}

export const panels = {
    manager: all_panels[0], config: all_panels[1], status: all_panels[2]
};

export const tasks = new Map();
export const download_types = ["get_missing_beatmaps", "get_player_beatmaps", "download_from_json"];

const btn_get_missing_beatmaps = document.getElementById("get_missing_beatmaps");
const btn_remove_invalid_maps = document.getElementById("remove_invalid_maps");
const get_player_beatmaps = document.getElementById("get_player_beatmaps");

const options_tab = sidebar_item[0];
const main_tab = sidebar_item[1];

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

other_btn.addEventListener("click", () => {
    main_tab.classList.add("active");
    options_tab.classList.remove("active");

    general_btn.classList.remove("active");
    other_btn.classList.add("active");
});

general_btn.addEventListener("click", () => {
    main_tab.classList.remove("active");
    options_tab.classList.add("active");
    
    general_btn.classList.add("active");
    other_btn.classList.remove("active");
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
    
    const tab = document.createElement("div");
    const h1  = document.createElement("h1");
    const h2  = document.createElement("h2");
    const bar = document.createElement("div");

    tab.classList.add("tab-shit");
    tab.classList.add("download-shit");

    tab.id = id;
    bar.style = "height: 1.5em; background-color: rgb(50, 120, 200); width: 0%; max-width: 100%;";

    h1.innerText = id;
    h1.id = id;
    h2.innerText = "waiting to start";

    tab.appendChild(h1);
    tab.appendChild(h2);
    tab.appendChild(bar);

    return {
        tab: tab, text: h2, dtab: d_tab, bar, id
    };
};

btn_remove_invalid_maps.addEventListener("click", async () => {
    
    const id = btn_remove_invalid_maps.id;
    const running_osu = await window.electron.is_running("osu!");

    if (running_osu) {
        create_alert("Please close osu to use this function");
        return;
    }

    const new_task = add_tab(id);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(id, data);
    
    await handle_event(data, remove_maps, id);
});

btn_get_missing_beatmaps.addEventListener("click", async () => {

    const id = btn_get_missing_beatmaps.id;

    if (core.login == null) {
        create_alert("Did you forgor to setup your config?");
        return;
    }

    const new_task = add_tab(id);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(id, data);
    
    await handle_event(data, missing_download, id);
});

get_player_beatmaps.addEventListener("click", async () => {

    // TOFIX: fix retarded [Object object] text on download thing after selecting "all" method

    if (core.login == null) {
        create_alert("Did you forgor to setup your config?");
        return;
    }

    const player = await create_custom_message({
        type: message_types.INPUT,
        title: "This feature is still experimental\nSo... are you sure?",
        label: "player name",
        input_type: "text",
    });

    if (!player) {
        return;
    }

    const method = await create_custom_message({
        type: message_types.CUSTOM_MENU,
        title: "method",
        elements: [{
            key: "name",
            element: { list: ["best performance", "first place", "favourites", "created maps", "all"] }
        }]
    });

    if (!method.name) {
        return;
    }

    const task_name = `${player} - ${method}`;
    const new_task = add_tab(task_name);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(task_name, data);
    
    await handle_event(data, download_from_players, player, method.name);
});

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