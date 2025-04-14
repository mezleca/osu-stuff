import { create_element } from "../global.js";
import { downloader } from "./client.js";
import { panels, blink, tabs } from "../../tabs.js";
import { quick_confirm } from "../../popup/popup.js";
import { core } from "../../app.js";

const on_download_create = (data) => {

    // check if we alredy renderer that item 
    if (document.getElementById(data.id)) {
        console.log("download element already exists");
        return;
    }

    const container = create_element(`
        <div class="download-container">
            <div class="download-header">
                <span class="file-name">placeholder</span>
                <span class="percentage">0%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: 0%;"></div>
            </div>
            <div class="download-footer">
                <span class="status-text">waiting to start...</span>
            </div>
        </div>    
    `);

    const name = container.querySelector(".file-name");

    container.id = data.id;
    name.textContent = data.name;

    // option to stop downloading
    container.addEventListener("click", async () => {

        const confirmation = await quick_confirm(`stop downloading ${data.name}?`);

        if (!confirmation) {
            return;
        }

        downloader.stop_download(data.id);
    });

    // add container to queue list
    panels.status.children[0].appendChild(container);
    blink(tabs.status);
};

const on_progress_update = (data) => {

    // get target container
    const target = document.getElementById(data.id);

    // if we fail to get target, end the current download (prob reseted or smth)
    if (!target) {
        downloader.stop_download(data.id);
        return;
    }
    
    if (data.status?.hash) {
        core.progress.update(`${data.status.success ? "downloaded" : "failed to download"} ${data.status.hash}`);
    }

    const value = Math.round((data.current / data.length) * 100);

    // get current download data
    const percentage_text = target.querySelector(".percentage");
    const progress_bar = target.querySelector(".progress-bar");
    const status = target.querySelector(".status-text");

    // update it
    percentage_text.textContent = value + "%";
    progress_bar.style.width = `${value}%`;
    status.textContent = value >= 90 ? "almost done..." : "downloading...";
};

const on_progress_end = (data) => {

    const target = document.getElementById(data.id);

    if (!target) {
        console.log("[downloader] failed to remove target on end", data);
        return;
    }

    core.progress.update(`finished downloading ${data.name}`);
    target.remove();
};

export const initialize_listeners = () => {
    downloader.setup_listeners({
        on_download_create: on_download_create,
        on_progress_update: on_progress_update,
        on_progress_end: on_progress_end
    });
};
