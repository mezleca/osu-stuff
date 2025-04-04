import { create_alert } from "./popup/popup.js";
import { safe_text } from "./utils/global.js";
import { close_window, maximize_window, minimize_window } from "./utils/other/process.js";

export const tasks = new Map();

export const all_tabs = [...document.querySelectorAll(".tab-button")];
export const all_panels = [...document.querySelectorAll(".tab-panel")];
export const tabs = { manager: all_tabs[0], config: all_tabs[1], status: all_tabs[2] };
export const panels = { manager: all_panels[0], config: all_panels[1], status: all_panels[2] };

// custom titlebar buttons
const maximize_btn = document.querySelector(".maximize");
const minimize_btn = document.querySelector(".minimize");
const close_btn = document.querySelector(".close");

maximize_btn.addEventListener("click", () => maximize_window);
minimize_btn.addEventListener("click", () => minimize_window);
close_btn.addEventListener("click", () => close_window);

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

export const blink = (tab) => {
    tab.style = "animation: blinker 1s linear infinite;";
    tab.addEventListener("click", () => {
        tab.style = "";
        tab.removeEventListener("click", () => {});
    });
};

const create_element = (html_string) => {
    return new DOMParser().parseFromString(html_string, "text/html").body.firstElementChild;
};

export const add_tab = (_id) => {

    const d_tab = document.getElementById("download_tab");
    const id = safe_text(_id);

    if (!id) {
        create_alert("missing id", { type: "error" });
        return null;
    }

    if (tasks.has(id)) {
        create_alert("theres already a download for this task", { type: "warning" });
        return null;
    }

    console.log("[tab] creating tab", id);

    const element = create_element(`
        <div class="cool-container download-shit">
            <h1></h1>
            <h2>waiting...</h2>
            <div style="height: 1.5em; background-color: rgb(50, 120, 200); width: 0%; max-width: 100%;"></div>
        </div>
    `);

    const title = element.querySelector("h1");
    const text = element.querySelector("h2");
    const bar = element.querySelector("div");

    title.id = id;
    title.textContent = id;
    text.innerHTML = "waiting...";

    return { 
        id: id,
        tab: element, 
        text: text, 
        dtab: d_tab, 
        bar: bar, 
    };
};
