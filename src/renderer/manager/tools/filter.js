import { core, manager_filters } from "../manager.js";
import { Reader } from "../../utils/reader/reader.js";
import { get_beatmap_sr, get_beatmap_bpm } from "./beatmaps.js";

const show_filter = document.querySelector(".show-filter");
const filter_box = document.querySelector(".filter-box");

show_filter.addEventListener("click", () => {
    if (show_filter.classList.contains("enabled")) {
        filter_box.classList.remove("enabled");
        show_filter.classList.remove("enabled");
    } else {
        filter_box.classList.add("enabled");
        show_filter.classList.add("enabled");
    }
});

const to_type = (v) => {
    const value = Number(v);
    return isNaN(value) ? v : value;
};

const validate_filter = (key, op, value) => {

    if (!key) {
        return false;
    }

    switch(op) {
        case "=":
            return key == value;
        case "!=":
            return key != value;
        case ">":
            return key > value;
        case ">=":
            return key >= value;
        case "<":
            return key < value;
        case "<=":
            return key <= value;  
    }

    return true;
}

// @TODO: more shit
export const search_filter = (beatmap) => {

    let query = core.search_query;
    let valid = true;

    if (query == "") {
        return true;
    }

    // filter by basic keywords
    const artist = beatmap?.artist || "unknown";
    const title = beatmap?.title || "unknown";
    const difficulty = beatmap?.difficulty || "unknown";
    const creator = beatmap?.mapper || "unknown";
    const tags = beatmap?.tags || "";
    
    for (let i = 0; i < core.search_filters.length; i++) {

        const filter = core.search_filters[i];
        query = query.replace(filter.text, "");
        
        if (!valid) {
            continue;
        }

        const thing = to_type(filter.v);

        // ignore invalid filters
        if (!thing) {
            continue;
        }
        
        if (!validate_filter(beatmap?.[filter.k], filter.o, thing)) {
            valid = false;
        }
    }

    if (!valid) {
        return false;
    }

    if (query == "") {
        return true;
    }

    const searchable_text = `${artist} ${title} ${difficulty} ${creator} ${tags}`.toLowerCase();
    const text_included = query.length > 0 ? searchable_text.includes(query.toLowerCase()) : true;

    return valid && text_included;
};

export const filter_beatmap = (md5) => {

    const sr_filter = manager_filters.get("manager-sr-filter");
    const bpm_filter = manager_filters.get("manager-bpm-filter");
    const status_filter = manager_filters.get("manager-status-filter");

    const beatmap = core.reader.osu.beatmaps.get(md5);
    const beatmap_sr = Math.floor(beatmap?.star * 100) / 100 || Number(get_beatmap_sr(beatmap));
    const beatmap_bpm = Math.floor(beatmap?.bpm * 100) / 100 || Number(get_beatmap_bpm(beatmap));

    // filter by status
    if (status_filter.selected.size > 0 && !status_filter.selected.has(Reader.get_status_object_reversed()[beatmap?.status])) {
        return false;
    }

    const sr_min = Number(sr_filter.min.value);
    const sr_max = Number(sr_filter.max.value);

    // filter by sr
    if (sr_max && (beatmap_sr < sr_min || beatmap_sr > sr_max)) {
        return false;
    }

    const bpm_min = Number(bpm_filter.min.value);
    const bpm_max = Number(bpm_filter.max.value);

    // filter by bpm
    if (bpm_max && (beatmap_bpm < bpm_min || beatmap_bpm > bpm_max)) {
        return false;
    }

    // filter by search
    const a = search_filter(beatmap);
    return a;
};
