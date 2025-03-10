import { create_alert } from "./popup/popup.js";

export const tasks = new Map();

export const all_tabs = [...document.querySelectorAll(".tab-button")];
export const all_panels = [...document.querySelectorAll(".tab-panel")];
export const tabs = { manager: all_tabs[0], config: all_tabs[1], status: all_tabs[2] };
export const panels = { manager: all_panels[0], config: all_panels[1], status: all_panels[2] };

// custom titlebar buttons
const maximize_btn = document.querySelector(".maximize");
const minimize_btn = document.querySelector(".minimize");
const close_btn = document.querySelector(".close");

maximize_btn.addEventListener("click", () => window.electron.maximize());
minimize_btn.addEventListener("click", () => window.electron.minimize());
close_btn.addEventListener("click", () => window.electron.close());

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
