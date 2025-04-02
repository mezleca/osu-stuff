import { initialize_config } from "./utils/config.js";
import { test_lazer } from "./utils/reader/lazer.js";

const in_dev_mode = process.env.NODE_ENV == "development";
const gui_title = document.querySelector(".title_text");

(async () => {
    
    // initialize config/manager
    await initialize_config();

    // test lazer
    const instance = await test_lazer("/home/rel/.local/share/osu/client.realm");

    if (instance) {
        console.log(instance.objects("Beatmap").toJSON());
    }
    
    // remove loading screen
    document.body.removeChild(document.getElementById('loading-screen'));

    if (in_dev_mode) {
        gui_title.innerText = "osu-stuff - (dev mode)";
    }
})();
