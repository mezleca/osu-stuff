import { core } from "../../app.js";
import { Reader } from "../../utils/reader/reader.js";
import { get_bpm_filter, get_sr_filter, get_status_filter } from "../manager.js";
import { get_beatmap_sr, get_beatmap_bpm } from "./beatmaps.js";

const show_filter = document.querySelector(".show-filter");
const filter_box = document.querySelector(".filter-box");
const search_input = document.getElementById("current_search");

show_filter.addEventListener("click", () => {
    if (show_filter.classList.contains("enabled")) {
        filter_box.classList.remove("enabled");
        show_filter.classList.remove("enabled");
    } else {
        filter_box.classList.add("enabled");
        show_filter.classList.add("enabled");
    }
});

export const filter_beatmap = (md5) => {

    const sr_filter = get_sr_filter();
    const bpm_filter = get_bpm_filter();
    const status_filter = get_status_filter();

    const beatmap = core.reader.osu.beatmaps.get(md5);
    const beatmap_sr = Math.floor(beatmap?.star_rating * 100) / 100 || Number(get_beatmap_sr(beatmap));
    const beatmap_bpm = Math.floor(beatmap?.bpm * 100) / 100 || Number(get_beatmap_bpm(beatmap));

    // filter by sr
    if (beatmap_sr < Number(sr_filter.min.value) || beatmap_sr > Number(sr_filter.max.value)) {
        return false;
    }

    // filter by status
    if (status_filter.selected.size > 0 && !status_filter.selected.has(Reader.get_status_object_reversed()[beatmap?.status])) {
        return false;
    }

    // filter by bpm
    if (beatmap_bpm < Number(bpm_filter.min.value) || beatmap_bpm > Number(bpm_filter.max.value)) {
        return false;
    }

    const search_filter = search_input.value;

    if (!search_filter) {
        return true;
    }

    // do this so the user can search for not downloaded beatmaps
    const artist = beatmap?.artist_name || "Unknown";
    const title = beatmap?.song_title || "Unknown";
    const difficulty = beatmap?.difficulty || "Unknown";
    const creator = beatmap?.mapper || "Unknown";
    const tags = beatmap?.tags || "";

    // filter by search
    const searchable_text = `${artist} ${title} ${difficulty} ${creator} ${tags}`.toLowerCase();
    return searchable_text.includes(search_filter.toLowerCase());
};
