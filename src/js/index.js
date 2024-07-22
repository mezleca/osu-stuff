import { add_config_shit } from "./stuff/utils/config/config.js";
import { add_alert } from "./popup/alert.js";
import { initialize } from "./manager/manager.js";

import * as fn from "./functions.js";

const in_dev_mode = Boolean(process.env.NODE_ENV);
const gui_title = document.querySelector(".title_text");

const remove_loading_screen = async (tab) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    document.body.removeChild(tab);
}

const enable_popup_test = () => {
    const button = document.querySelector("#test_popup");
    button.style.display = "block";
};

document.addEventListener("DOMContentLoaded", async () => {

    console.log("Loaded DOM");

    await add_config_shit();
    await initialize();
    await remove_loading_screen(document.getElementById('loading-screen'));

    if (in_dev_mode) {

        enable_popup_test();

        gui_title.innerText = "osu-stuff - (dev mode)";
        add_alert("You're running in dev mode", { type: "warning" });
    }

    console.log("Ready");
});