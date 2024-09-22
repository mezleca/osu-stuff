import { handle_event } from "./events.js";
import { add_alert, add_get_extra_info } from "./popup/popup.js";
import { is_running } from "./utils/other/process.js";
import { core } from "./utils/config.js";
import { remove_maps } from "./stuff/remove_maps.js";
import { missing_download } from "./stuff/missing.js";
import { download_from_players } from "./stuff/download_from_players.js";

export const all_tabs = [...document.querySelectorAll(".tab-button")];
export const all_content = [...document.querySelectorAll(".tab-pane")];
export const sidebar_item = [...document.querySelectorAll(".sidebar-item")];
export const extra_tab = document.querySelector(".btn-extra");

export const tasks = new Map();
export const download_types = ["get_missing_beatmaps", "get_player_beatmaps", "download_from_json"];

const btn_get_missing_beatmaps = document.getElementById("get_missing_beatmaps");
const btn_remove_invalid_maps = document.getElementById("remove_invalid_maps");
const get_player_beatmaps = document.getElementById("get_player_beatmaps");
const back_btn = document.querySelector(".back-btn");

const options_tab = sidebar_item[0];
const main_tab = sidebar_item[1];

// set the active tab
all_tabs.map((tab, i) => {
    
    tab.addEventListener("click", (e) => {
        
        const already_active = tab.className == "active";

        if (already_active) {
            return;
        }

        all_tabs.forEach((t) => { t.classList.remove("active") });
        all_content.forEach((t) => { t.classList.remove("active") });

        tab.classList.add("active");
        all_content[i].classList.add("active");
    });
});

extra_tab.addEventListener("click", () => {
    options_tab.classList.remove("active");
    main_tab.classList.add("active");
});

back_btn.addEventListener("click", () => {
    options_tab.classList.add("active");
    main_tab.classList.remove("active");
});

// get the current active tab
export const get_current_tab = () => {
    
    for (let i = 0; i < all_tabs.length; i++) {

        if (all_tabs[i].classList.contains("active")) {
            return all_content[i].id;
        }
    }

    return null;
};

// make a tab blink until the user clicks on it
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
        add_alert("Missing id", { type: "error" });
        return null;
    }

    if (tasks.has(id)) {
        add_alert("theres already a download for this task", { type: "warning" });
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
        tab: tab,
        text: h2,
        dtab: d_tab,
        bar,
        id
    };
};

btn_remove_invalid_maps.addEventListener("click", async () => {
    
    const id = btn_remove_invalid_maps.id;
    const running_osu = await is_running("osu!");

    if (running_osu) {
        add_alert("Please close osu to use this function");
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
        add_alert("Did you forgor to setup your config?");
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

    if (core.login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    const player = await add_get_extra_info([{
        type: "input",
        text: "player name",
        important: false
    }]);

    if (!player) {
        return;
    }

    // TODO: use select tag instead of buttons so the user can select more than 1 option
    const method =  await add_get_extra_info([{
        type: "list",
        value: ["best performance", "first place", "favourites", "all"],
        important: false,
        title: "method"
    }]);

    if (!method) {
        return;
    }

    const task_name = `${player} - ${method}`;
    const new_task = add_tab(task_name);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(task_name, data);
    
    await handle_event(data, download_from_players, player, method);
});

export const create_download_task = async (name, maps) => {

    const new_task = add_tab(name);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(name, data);
    blink(all_tabs[2]);
    
    await handle_event(data, () => { return maps });
};