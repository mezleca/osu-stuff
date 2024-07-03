import { add_config_shit } from "./stuff/utils/config.js";

/* 
* Wait for the DOM to be loaded before loading the scripts
* So the user know the app is still loading and not frozen.
*/

const remove_loading_screen = async (tab) => {

    // wait the fading animation (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));

    document.body.removeChild(tab);
}

document.addEventListener("DOMContentLoaded", async () => {

    console.log("Loaded DOM");

    await add_config_shit();
    await remove_loading_screen(document.getElementById('loading-screen'));

    console.log("Ready");
});