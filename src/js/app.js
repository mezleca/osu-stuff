import { add_config_shit } from "./utils/config.js";
import { add_alert } from "./popup/popup.js";
import { initialize } from "./manager/manager.js";

const in_dev_mode = process.env.NODE_ENV == "cleide";
const gui_title = document.querySelector(".title_text");

(async () => {

    // initialize config/manager
    await add_config_shit();
    await initialize();
    
    // remove loading screen
    await new Promise(resolve => setTimeout(resolve, 200));
    document.body.removeChild(document.getElementById('loading-screen'));

    if (in_dev_mode) {
        gui_title.innerText = "osu-stuff - (dev mode)";
        add_alert("You're running in dev mode", { type: "warning" });
    }
})();