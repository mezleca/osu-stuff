import { beatmap_status, beatmap_status_reversed } from "../../stuff/remove_maps.js";
import { core } from "../../utils/config.js";
import { get_beatmap_sr, get_beatmap_bpm } from "../tools/beatmaps.js";

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

const create_element = (data) => {
    return new DOMParser().parseFromString(data, "text/html").body.firstElementChild;
};

export const create_range_filter = (id, text, iden, fix, initial) => {

    const html = `
    <div class="slider-container" id="${id}">
        <div class="slider-header">
            <span class="slider-label">${text}</span>
            <span class="slider-values" id="slider-values">(0.0${iden} - ${initial}.0${iden})</span>
        </div>
        <div class="range-container">
            <div class="track"></div>
            <div class="track-highlight" id="track-highlight"></div>
            <input type="range" min="0" max="${initial}" value="0" step="0.01" class="min-slider" id="min-sr">
            <input type="range" min="0" max="${initial}" value="${initial}" step="0.01" class="max-slider" id="max-sr">
        </div>
    </div>
    `;

    const range_slider = {
        min: null,      // name
        max: null,      // name
        limit: null,    // yep limit
        element: create_element(html),
        update: null,   // function to update slider values
        callback: null, // function to run after min/max change
        set_limit: null // function to set limit
    }
    
    range_slider.min = range_slider.element.querySelector("#min-sr");
    range_slider.max = range_slider.element.querySelector("#max-sr");
    range_slider.limit = range_slider.max.value;
    
    const slider_values = range_slider.element.querySelector("#slider-values");
    const track_highlight = range_slider.element.querySelector("#track-highlight");

    const force_update = () => {
        requestAnimationFrame(() => {
            track_highlight.style.display = 'none';
            track_highlight.offsetHeight;
            track_highlight.style.display = '';
        });
    };

    const set_limit = (new_limit) => {

        new_limit = parseFloat(new_limit);

        if (isNaN(new_limit)) {
            return;
        }

        range_slider.limit = new_limit;
        range_slider.min.setAttribute("max", new_limit);
        range_slider.max.setAttribute("max", new_limit);
        
        const min_value = parseFloat(range_slider.min.value);
        range_slider.max.value = new_limit;
        
        if (min_value > new_limit) {
            range_slider.min.value = Math.max(0, new_limit - 0.1);
        }
        
        update();
    };

    const update = () => {

        let min_value = parseFloat(range_slider.min.value);
        let max_value = parseFloat(range_slider.max.value);
        
        // prevent min exceeding max
        if (min_value >= max_value) {

            if (min_value - 0.1 < 0) {
                return;
            }

            range_slider.min.value = (max_value - 0.1).toFixed(fix);
            min_value = parseFloat(range_slider.min.value);
        }

        if (max_value > range_slider.limit) {
            max_value = range_slider.limit;
            range_slider.max.value = max_value;
        }
        
        if (min_value < 0) {
            min_value = 0;
            range_slider.min.value = 0;
        }
        
        // update display
        slider_values.innerText = `(${min_value.toFixed(fix)}${iden} - ${max_value.toFixed(fix)}${iden})`;
        
        // update tracker
        const min_percent = (min_value / range_slider.limit) * 100;
        const max_percent = (max_value / range_slider.limit) * 100;
        const width_percent = max_percent - min_percent;
        
        track_highlight.style.width = `${width_percent}%`;
        track_highlight.style.left = `${min_percent}%`;
        
        force_update();
        if (range_slider.callback) range_slider.callback();
    };
    
    set_limit(range_slider.limit);

    range_slider.update = update;
    range_slider.set_limit = set_limit;

    range_slider.min.addEventListener("input", update);
    range_slider.max.addEventListener("input", update);

    return range_slider;
};

export const create_dropdown_filter = (id, name, options) => {

    const html = `
        <div class="dropdown-container" id="${id}">
            <div class="dropdown-header">
                <span class="dropdown-label">${name}</span>
            </div>
            <div class="dropdown-content">
                <div class="dropdown-item" data-value="all">
                    <label>all</label>
                </div>
                ${options
                    .map((v) => {
                        if (v != "all") {
                            return `<div class="dropdown-item" data-value="${v}">
                                <label>${v}</label>
                            </div>`;
                        }
                    })
                    .join("\n")}
            </div>
            <div class="selected-options" id="selected-options"></div>
        </div>
    `;

    const dropdown_filter = {
        selected: [],
        element: create_element(html),
        callback: null,
    };

    const dropdown_header = dropdown_filter.element.querySelector(".dropdown-header");
    const dropdown_content = dropdown_filter.element.querySelector(".dropdown-content");
    const selected_options_div = dropdown_filter.element.querySelector(".selected-options");
    const all_item = dropdown_filter.element.querySelector('.dropdown-item[data-value="all"]');
    const item_items = [
        ...dropdown_filter.element.querySelectorAll(".dropdown-item"),
    ].filter((item) => item.dataset.value != "all");
    const all_options = item_items.map((item) => item.dataset.value);

    dropdown_header.addEventListener("click", () => {
        dropdown_content.classList.toggle("show");
    });

    dropdown_content.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    const dropdown_items = [...dropdown_filter.element.querySelectorAll(".dropdown-item")];

    dropdown_items.forEach((item) => {

        item.addEventListener("click", () => {

            const value = item.dataset.value;

            if (value == "all") {
                if (dropdown_filter.selected.length == all_options.length) {
                    dropdown_filter.selected = [];
                } else {
                    dropdown_filter.selected = [...all_options];
                }
            } else {
                if (dropdown_filter.selected.includes(value)) {
                    dropdown_filter.selected = dropdown_filter.selected.filter((v) => v != value);
                } else {
                    dropdown_filter.selected.push(value);
                }
            }
            update();
        });
    });

    const update = () => {

        item_items.forEach((item) => {
            if (dropdown_filter.selected.includes(item.dataset.value)) {
                item.classList.add("dropdown-item-selected");
            } else {
                item.classList.remove("dropdown-item-selected");
            }
        });

        if (dropdown_filter.selected.length == all_options.length) {
            all_item.classList.add("dropdown-item-selected");
        } else {
            all_item.classList.remove("dropdown-item-selected");
        }

        selected_options_div.innerHTML = "";
        dropdown_filter.selected.forEach((value) => {

            const option_tag = document.createElement("div");
            option_tag.className = "option-tag";

            const option_text = document.createElement("span");
            option_text.textContent = value;

            const remove_btn = document.createElement("span");
            remove_btn.className = "remove-option";
            remove_btn.innerHTML = "×";

            remove_btn.addEventListener("click", (e) => {
                e.stopPropagation();
                dropdown_filter.selected = dropdown_filter.selected.filter((v) => v != value);
                update();
            });

            option_tag.appendChild(option_text);
            option_tag.appendChild(remove_btn);
            selected_options_div.appendChild(option_tag);
        });

        if (dropdown_filter.callback) {
            dropdown_filter.callback();
        }
    }

    update();

    return dropdown_filter;
};

export const filter_beatmap = (md5) => {

    const beatmap = core.reader.osu.beatmaps.get(md5);
    const beatmap_sr = Number(get_beatmap_sr(beatmap));
    const beatmap_bpm = Number(get_beatmap_bpm(beatmap));

    // filter by sr
    if (beatmap_sr < Number(sr_filter.min.value) || beatmap_sr > Number(sr_filter.max.value)) {
        return false;
    }

    // filter by status
    if (status_filter.selected.length > 0 && !status_filter.selected.includes(beatmap_status_reversed[beatmap?.status])) {
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

export const sr_filter = create_range_filter("manager-sr-filter", "difficulty range", "★", 2, 10);
export const bpm_filter = create_range_filter("manager-bpm-filter", "bpm range", "", 0, 500);
export const status_filter = create_dropdown_filter("dropdown-status-filter", "status", Object.keys(beatmap_status));
