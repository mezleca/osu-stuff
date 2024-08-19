import { handle_event } from "./tasks/events.js";
import { add_alert } from "./popup/popup.js";
import { add_collection, download_collector } from "./stuff/collector.js";
import { is_running } from "./stuff/utils/other/process.js";
import { login } from "./stuff/utils/config/config.js";
import { download_from_json } from "./stuff/download_json.js";
import { remove_maps } from "./stuff/remove_maps.js";
import { export_missing, missing_download } from "./stuff/missing.js";
import { download_from_players } from "./stuff/download_from_players.js";

export const all_tabs = [...document.querySelectorAll(".tab-button")];
export const all_content = [...document.querySelectorAll(".tab-pane")];

export const tasks = new Map();
export const download_types = ["get_missing_beatmaps", "get_player_beatmaps", "download_from_json"];

const btn_get_missing_beatmaps = document.getElementById("get_missing_beatmaps");
const btn_export_missing_beatmaps = document.getElementById("export_missing_beatmaps");
const btn_remove_invalid_maps = document.getElementById("remove_invalid_maps");
const get_beatmaps_collector = document.getElementById("get_beatmaps_collector");
const add_beatmaps_collector = document.getElementById("add_beatmaps_collector");
const btn_download_from_json = document.getElementById("download_from_json");
const get_player_beatmaps = document.getElementById("get_player_beatmaps");
const test_popup = document.getElementById("test_popup");

const test_alerts = async () => {
  
    for (let i = 0; i < 3; i++) {
        add_alert("Popup", i, { seconds: 60 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
};

// set the active tab
all_tabs.map((tab, i) => {
    
    tab.addEventListener("click", (e) => {
        
        const user_is_stupid = tab.className == "active";

        if (user_is_stupid) {
            return;
        }

        all_tabs.forEach((t) => { t.classList.remove("active") });
        all_content.forEach((t) => { t.classList.remove("active") });

        tab.classList.add("active");
        all_content[i].classList.add("active");
    });
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

btn_download_from_json.addEventListener("click", async () => {

    const id = btn_download_from_json.id;

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    const new_task = add_tab(id);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(id, data);

    await handle_event(data, download_from_json, id);
});

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

btn_export_missing_beatmaps.addEventListener("click", async () => {

    const id = btn_export_missing_beatmaps.id;

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    const new_task = add_tab(id);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(id, data);
    
    await handle_event(data, export_missing, id);
});

btn_get_missing_beatmaps.addEventListener("click", async () => {

    const id = btn_get_missing_beatmaps.id;

    if (login == null) {
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

add_beatmaps_collector.addEventListener("click", async () => {

    const id = document.getElementById("oscurl");
    const running_osu = await is_running("osu!");

    if (running_osu) {
        add_alert("Please close osu to use this function");
        return;
    }

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    if (id.value == "") {
        return;
    }

    await add_collection(id.value);
});

get_beatmaps_collector.addEventListener("click", async () => {

    const id = document.getElementById("oscurl");

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    if (id.value == "") {
        return;
    }

    const new_task = add_tab(id.value);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(id.value, data);

    // manual blink ;-;
    blink(all_tabs[3]);
    
    await handle_event(data, download_collector, id.value, id.value);
});

get_player_beatmaps.addEventListener("click", async () => {

    const id = get_player_beatmaps.id;

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    const new_task = add_tab(id);

    if (!new_task) {
        return;
    }

    const data = { started: false, ...new_task };
    tasks.set(id, data);
    
    await handle_event(data, download_from_players, id);
});

test_popup.addEventListener("click", async () => {  
    await test_alerts();
});