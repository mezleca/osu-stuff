import { core } from "../../app.js";
import { create_alert } from "../../popup/popup.js";
import { safe_id, safe_text } from "../../utils/global.js";
import { Reader } from "../../utils/reader/reader.js";
import { get_bpm_filter, get_sr_filter, get_status_filter } from "../manager.js";
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

    if (isNaN(Number(initial))) {
        console.log(iden, initial);
        create_alert("failed to create dropdown...", { type: "error" });
        return;
    }

    const element = create_element(`
        <div class="slider-container" id="${safe_id(id)}">
            <div class="slider-header">
                <span class="slider-label"></span>
                <span class="slider-values" id="slider-values">(0.0${iden} - ${initial}.0${iden})</span>
            </div>
            <div class="range-container">
                <div class="track"></div>
                <div class="track-highlight" id="track-highlight"></div>
                <input type="range" min="0" max="${initial}" value="0" step="0.01" class="min-slider" id="min-sr">
                <input type="range" min="0" max="${initial}" value="${initial}" step="0.01" class="max-slider" id="max-sr">
            </div>
        </div>
    `);

    const range_slider = {
        min: null,
        max: null,
        limit: null,
        element: element,
        update: null,
        callback: null,
        set_limit: null
    }
    
    const slider_label = element.querySelector(".slider-label");
    const slider_values = element.querySelector(".slider-values");
    const track_highlight = element.querySelector("#track-highlight");

    slider_values.textContent = `(0.0${iden} - ${initial}.0${iden})`;
    slider_label.textContent = text;
    
    range_slider.min = element.querySelector("#min-sr");
    range_slider.max = element.querySelector("#max-sr");
    range_slider.limit = range_slider.max.value;
    

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
        slider_values.textContent = `(${min_value.toFixed(fix)}${iden} - ${max_value.toFixed(fix)}${iden})`;
        
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

    const element = create_element(`
        <div class="dropdown-container" id="${safe_id(id)}">
            <div class="dropdown-header">
                <span class="dropdown-label"></span>
            </div>
            <div class="dropdown-content">
                <div class="dropdown-item" data-value="all">
                    <label>all</label>
                </div>
            </div>
            <div class="selected-options" id="selected-options"></div>
        </div>
    `);

    const label = element.querySelector(".dropdown-label");
    const content = element.querySelector(".dropdown-content");
    const dropdown_header = element.querySelector(".dropdown-header");
    const dropdown_content = element.querySelector(".dropdown-content");
    const selected_options_div = element.querySelector(".selected-options");
    
    label.textContent = name;

    for (let option of options) {
        if (option == "all") {
            continue;
        }

        const item = create_element(`
            <div class="dropdown-item">
                <label></label>
            </div>
        `);

        item.setAttribute("data-value", option);
        item.children[0].textContent = option;
        content.appendChild(item);
    }

    const dropdown_filter = {
        id: safe_id(id),
        name: name,
        selected: new Set(),
        element: element,
        callback: null,
    };
    
    const item_items = [...element.querySelectorAll(".dropdown-item")].filter(item => item.dataset.value != "all");
    const all_item = element.querySelector('.dropdown-item[data-value="all"]');
    const dropdown_items = [...element.querySelectorAll(".dropdown-item")];
    const all_options = item_items.map(item => item.dataset.value);
    
    dropdown_header.addEventListener("click", () => dropdown_content.classList.toggle("show"));
    dropdown_content.addEventListener("click", e => e.stopPropagation());

    dropdown_items.forEach(item => {

        item.addEventListener("click", () => {

            const value = item.dataset.value;

            if (value == "all") {
                if (dropdown_filter.selected.size == all_options.length) {
                    dropdown_filter.selected.clear();
                } else {
                    dropdown_filter.selected = new Set(all_options);
                }
            } else {
                if (dropdown_filter.selected.has(value)) {
                    dropdown_filter.selected.delete(value);
                } else {
                    dropdown_filter.selected.add(value);
                }
            }
            update();
        });
    });

    const update = () => {

        for (const item of item_items) {
            if (dropdown_filter.selected.has(item.dataset.value)) {
                item.classList.add("dropdown-item-selected");
            } else {
                item.classList.remove("dropdown-item-selected");
            }
        }

        if (dropdown_filter.selected.size == all_options.length) {
            all_item.classList.add("dropdown-item-selected");
        } else {
            all_item.classList.remove("dropdown-item-selected");
        }

        selected_options_div.innerHTML = "";

        for (const value of dropdown_filter.selected) {

            const option_tag = document.createElement("div");
            option_tag.className = "option-tag";

            const option_text = document.createElement("span");
            option_text.textContent = value;

            const remove_btn = document.createElement("span");
            remove_btn.className = "remove-option";
            remove_btn.innerHTML = "×";

            remove_btn.addEventListener("click", e => {
                e.stopPropagation();
                dropdown_filter.selected.delete(value);
                update();
            });

            option_tag.appendChild(option_text);
            option_tag.appendChild(remove_btn);
            selected_options_div.appendChild(option_tag);
        }

        if (dropdown_filter.callback) {
            dropdown_filter.callback();
        }
    }

    update();
    return dropdown_filter;
};

export const create_tag_filter = (id, name, placeholder, add_button, limit) => {
    
    const html = create_element(`
        <div class="tag-container" id="${safe_id(id)}">
            <div class="tag-input-area">
                <input type="text" class="tag-input" id="tag-input">
                ${add_button ?
                    `<button class="tag-add-button" id="tag-add-button">
                        <i class="bi bi-plus-lg"></i>
                    </button>` 
                    : 
                    ""
                }        
            </div>
            <div class="tag-list" id="tag-list"></div>
        </div>
    `);

    const tag_filter = {
        id: safe_id(id),
        element: html,
        values: new Set()
    };

    const tag_list = html.querySelector(".tag-list");
    const input = html.querySelector(".tag-input");

    input.placeholder = placeholder;

    const create_tag_value = () => {

        const element = create_element(`
            <div class="tag-item">
                <span class="tag-item-content"></span>
            </div>
        `);

        const text = input.value;

        element.children[0].textContent = `× ${text}`;
        element.addEventListener("click", () => {
            element.style.opacity = "0";
            element.style.transform = "translateY(5px)";
            setTimeout(() => {
                tag_filter.values.delete(text);
                element.remove(); 
            }, 100);
        });

        return element;
    };

    const add_value = () => {

        const new_value = input.value;

        if (new_value == "") {
            return;
        }

        if (tag_filter.values.has(new_value)) {
            input.value = "";
            input.focus();
            return;
        }

        if (tag_filter.values.size >= limit) {
            create_alert(`reached the limit (${limit})`, { type: "warning" });
            return;
        }

        const element = create_tag_value();

        tag_filter.values.add(input.value);
        tag_list.appendChild(element);

        input.value = "";
        input.focus();
    };
    
    if (add_button) {
        html.querySelector(".tag-add-button").addEventListener("click", add_value);
    }

    input.addEventListener("keyup", (event) => { if (event.key == "Enter") add_value()});

    return tag_filter;
};

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
