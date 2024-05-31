import { add_alert } from "./popup/alert.js";
import { add_task, login } from "./tabs.js";
import { add_collection } from "./stuff/collector.js";
import { is_running } from "./stuff/utils/process.js";

const btn_get_missing_beatmaps = document.getElementById("get_missing_beatmaps");
const btn_export_missing_beatmaps = document.getElementById("export_missing_beatmaps");
const btn_remove_invalid_maps = document.getElementById("remove_invalid_maps");
const get_beatmaps_collector = document.getElementById("get_beatmaps_collector");
const add_betamps_collector = document.getElementById("add_beatmaps_collector");
const btn_download_from_json = document.getElementById("download_from_json");

btn_download_from_json.addEventListener("click", async () => {

    if (login == null) {
        add_alert("Did you forgor to setup your config?");
        return;
    }

    add_task({ id: "download maps from json"}, "json");
});

btn_remove_invalid_maps.addEventListener("click", async () => {

    const running_osu = await is_running("osu!");

    if (running_osu) {
        add_alert("Please close osu to use this function");
        return;
    }

    add_task({ id: "remove_maps"}, "remove_maps");
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
    const running_osu = await is_running("osu!");

    if (running_osu) {
        add_alert("Please close osu to use this function");
        return;
    }

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