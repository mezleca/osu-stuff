import { initialize_config } from "./utils/config.js";
import { downloader } from "./utils/downloader/client.js";
import { initialize_listeners } from "./utils/downloader/events.js";
import { core } from "./manager/manager.js";

const in_dev_mode = window.process.env.STUFF_ENV == "dev";
const gui_title = document.querySelector(".title_text");

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
