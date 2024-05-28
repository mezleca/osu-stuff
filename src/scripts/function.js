import { add_alert } from "./popup/alert.js";
import { add_task, login } from "./tabs.js";
import { add_collection } from "./stuff/collector.js";

const btn_get_missing_beatmaps = document.getElementById("get_missing_beatmaps");
const btn_export_missing_beatmaps = document.getElementById("export_missing_beatmaps");
const btn_remove_invalid_maps = document.getElementById("remove_invalid_maps");
const get_beatmaps_collector = document.getElementById("get_beatmaps_collector");
const add_betamps_collector = document.getElementById("add_beatmaps_collector");
const btn_download_from_json = document.getElementById("download_from_json");

// document.getElementById("collector_test").addEventListener("click", async () => {

//     const collections = ["https://osucollector.com/collections/11417/RX-Jumps", "https://osucollector.com/collections/11419/Beginner-Pack-1"];

//     for (let i = 0; i < collections.length; i++) {

//         const id = collections[i];

//         if (login == null) {
//             add_alert("Did you forgor to setup your config?");
//             return;
//         }

//         if (id == "") {
//             return;
//         }

//         // sleep 1s
//         await new Promise((res) => setInterval(() => res(), 1000));

//         add_task({ id: id, url: id }, "collector");
//     }
// });

btn_download_from_json.addEventListener("click", () => {
    add_alert("TODO");
});

btn_remove_invalid_maps.addEventListener("click", () => {
    add_alert("TODO");
});

btn_export_missing_beatmaps.addEventListener("click", async () => {

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    add_task({ id: "export missing maps" }, "export_missing");
});

btn_get_missing_beatmaps.addEventListener("click", async () => {

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    add_task({ id: "missing maps" }, "missing");
});

add_betamps_collector.addEventListener("click", async () => {

    const id = document.getElementById("oscurl");

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    if (id.value == "") {
        return;
    }

    await add_collection(id.value);
});

get_beatmaps_collector.addEventListener("click", () => {

    const id = document.getElementById("oscurl");

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    if (id.value == "") {
        return;
    }

    add_task({ id: id.value, url: id.value }, "collector");
});