const all_tabs = [...document.querySelectorAll(".tab-button")];
const all_content = [...document.querySelectorAll(".tab-pane")];

import { events } from "./tasks/events.js";
import { add_alert } from "./popup/alert.js";

export const current_tasks = new Map();

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

    // TODO: enable progress stuff when the task actually start.
    dtab.appendChild(tab);

    events.emit("task-start", { id: id, type: type, ...data});
};