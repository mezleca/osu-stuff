import { add_config_shit } from "./stuff/utils/config/config.js";
import { add_alert } from "./popup/popup.js";
import { initialize } from "./manager/manager.js";

const in_dev_mode = Boolean(process.env.NODE_ENV);
const gui_title = document.querySelector(".title_text");

const remove_loading_screen = async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    document.body.removeChild(document.getElementById('loading-screen'));
}

const enable_popup_test = () => {
    const button = document.querySelector("#test_popup");
    button.style.display = "block";
};

const main = async () => {

    await add_config_shit();
    await initialize();
    await remove_loading_screen();

    if (in_dev_mode) {

        enable_popup_test();

        gui_title.innerText = "osu-stuff - (dev mode)";
        add_alert("You're running in dev mode", { type: "warning" });
    }

    console.log("Ready");
};

main();