import { create_progress } from "./manager/ui/progress.js";
import { initialize_config } from "./utils/config.js";
import { downloader } from "./utils/downloader/client.js";
import { initialize_listeners } from "./utils/downloader/events.js";
import { Reader } from "./utils/reader/reader.js";

const in_dev_mode = window.process.env.STUFF_ENV == "development";
const gui_title = document.querySelector(".title_text");

export const core = {
    reader: new Reader(),
    config: new Map(),
    mirrors: new Map(),
    progress: create_progress({ }),
    og_path: "",
    login: null, 
};

(async () => {
    
    // initialize config/manager
    await initialize_config();

    // initialize downloader client
    await initialize_listeners();
    await downloader.intitialize();

    // remove loading screen
    document.body.removeChild(document.getElementById('loading-screen'));
    core.progress.update("initialized");

    if (in_dev_mode) {
        gui_title.innerText = "osu-stuff - (dev mode)";
    }
})();
