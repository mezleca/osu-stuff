import { add_config_shit } from "./stuff/utils/config.js";
import * as fn from "./functions.js";

const remove_loading_screen = async (tab) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    document.body.removeChild(tab);
}

document.addEventListener("DOMContentLoaded", async () => {

    console.log("Loaded DOM");

    await add_config_shit();
    await remove_loading_screen(document.getElementById('loading-screen'));

    console.log("Ready");
});