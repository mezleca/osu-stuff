import { create_progress } from "./manager/ui/progress.js";
import { initialize_config } from "./utils/config.js";
import { Reader } from "./utils/reader/reader.js";

const in_dev_mode = window.process.env.NODE_ENV == "development";
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
 
    // remove loading screen
    document.body.removeChild(document.getElementById('loading-screen'));
    core.progress.update("initialized");

    if (in_dev_mode) {
        gui_title.innerText = "osu-stuff - (dev mode)";
    }
})();
