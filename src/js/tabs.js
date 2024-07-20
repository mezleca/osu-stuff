import { events } from "./tasks/events.js";
import { add_alert } from "./popup/alert.js";

export const all_tabs = [...document.querySelectorAll(".tab-button")];
export const all_content = [...document.querySelectorAll(".tab-pane")];

export const current_tasks = new Map();
export const download_types = ["collector", "missing", "download_from_players", "json"];

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
    const h1 = document.createElement("h1");
    const h2 = document.createElement("h2");
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