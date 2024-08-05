import { events } from "./tasks/events.js";
import { add_alert } from "./popup/alert.js";
import { add_collection } from "./stuff/collector.js";
import { is_running } from "./stuff/utils/other/process.js";
import { login } from "./stuff/utils/config/config.js";

export const all_tabs = [...document.querySelectorAll(".tab-button")];
export const all_content = [...document.querySelectorAll(".tab-pane")];

export const current_tasks = new Map();
export const download_types = ["collector", "missing", "download_from_players", "json"];

const btn_get_missing_beatmaps = document.getElementById("get_missing_beatmaps");
const btn_export_missing_beatmaps = document.getElementById("export_missing_beatmaps");
const btn_remove_invalid_maps = document.getElementById("remove_invalid_maps");
const get_beatmaps_collector = document.getElementById("get_beatmaps_collector");
const add_betamps_collector = document.getElementById("add_beatmaps_collector");
const btn_download_from_json = document.getElementById("download_from_json");
const get_player_beatmaps = document.getElementById("get_player_beatmaps");
const test_popup = document.getElementById("test_popup");

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

// add a task (yep)
export const add_task = (data, type) => {

    const id = data.id;

    if (!id) {
        add_alert("Missing id", { type: "error" });
        return;
    }

    if (current_tasks.has(id)) {
        add_alert("theres already a download for this task", { type: "warning" });
        return;
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
    h2.innerText = "waiting to start";

    tab.appendChild(h1);
    tab.appendChild(h2);
    tab.appendChild(bar);

    const dtab = document.getElementById("download_tab");

    current_tasks.set(id, { started: false, tab: dtab, Fdiv: tab, bar: bar, text: h2 });
    events.emit("task-start", { id: id, type: type, ...data, dtab, tab});
};

// functions

btn_download_from_json.addEventListener("click", async () => {

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    add_task({ id: "download maps from json"}, "json");
});

btn_remove_invalid_maps.addEventListener("click", async () => {

    const running_osu = await is_running("osu!");

    if (running_osu) {
        add_alert("Please close osu to use this function");
        return;
    }

    add_task({ id: "remove_maps"}, "remove_maps");
});

btn_export_missing_beatmaps.addEventListener("click", async () => {

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    add_task({ id: "export missing maps" }, "export_missing");
});

btn_get_missing_beatmaps.addEventListener("click", async () => {

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    add_task({ id: "missing maps" }, "missing");
});

add_betamps_collector.addEventListener("click", async () => {

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

get_beatmaps_collector.addEventListener("click", () => {

    const id = document.getElementById("oscurl");

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    if (id.value == "") {
        return;
    }

    add_task({ id: id.value, url: id.value }, "collector");
});

get_player_beatmaps.addEventListener("click", async () => {

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    add_task({ id: "download_from_players" }, "download_from_players");
});

test_popup.addEventListener("click", () => {
    events.emit("task-start", { type: "test_popup" });
});