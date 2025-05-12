import { create_element } from "../global.js";
import { downloader } from "./client.js";
import { panels, blink, tabs } from "../../tabs.js";
import { quick_confirm } from "../../popup/popup.js";
import { core } from "../../manager/manager.js";

const create_download_box = (data) => {

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

    return { container: container };
};

const on_download_create = (data) => {

    // check if we alredy renderer that item 
    if (document.getElementById(data.id)) {
        console.log("download element already exists");
        return;
    }

    // add container to queue list
    const { container } = create_download_box(data);
    panels.status.children[0].appendChild(container);

    blink(tabs.status);
};

const on_progress_update = (data) => {

    // get target container
    const target = document.getElementById(data.id);

    // shouldn't happen
    if (!target) {
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
    const progress = ` (${data.current} / ${data.length})`;
    percentage_text.textContent = value + "%";
    progress_bar.style.width = `${value}%`;
    status.textContent = value >= 90 ? "almost done..." : "downloading..." + progress;
};

const on_progress_end = (data) => {

    const target = document.getElementById(data.id);

    if (!target) {
        console.log("[downloader] failed to remove target on end", data);
        return;
    }

    core.progress.update(`finished downloading (${data.name})`);
    target.remove();
};

export const initialize_listeners = async () => {

    const is_downloading = await downloader.is_downloading();

    // check if we are download something in the main process
    if (is_downloading) {

        const list = await downloader.get_queue();

        if (list.length == 0) {
            return;
        }

        core.progress.update("restoring downloads...");
        
        for (let i = 0; i < list.length; i++) {
            const current = list[i];
            const { container } = create_download_box(current);
            panels.status.children[0].appendChild(container);
            blink(tabs.status);
        }
    }

    downloader.setup_listeners({
        on_download_create: on_download_create,
        on_progress_update: on_progress_update,
        on_progress_end: on_progress_end
    });
};
