const show_filter = document.querySelector(".show-filter");
const filter_box = document.querySelector(".filter-box");

show_filter.addEventListener("click", () => {

    if (show_filter.classList.contains("enabled")) {
        filter_box.classList.remove("enabled");
        show_filter.classList.remove("enabled");
        show_filter.children[0].classList.remove("bi-arrow-up");
        show_filter.children[0].classList.add("bi-arrow-down");
    } else {
        filter_box.classList.add("enabled");
        show_filter.classList.add("enabled");
        show_filter.children[0].classList.add("bi-arrow-up");
        show_filter.children[0].classList.remove("bi-arrow-down");
    }
});

const create_element = (data) => {
    return new DOMParser().parseFromString(data, "text/html").body.firstElementChild;
};

export const create_sr_filter = (id) => {

    const html = `
    <div class="slider-container" id="${id}">
        <div class="slider-header">
            <span class="slider-label">star rating</span>
            <span class="slider-values" id="slider-values">(0.0★ - 100.0★)</span>
        </div>
        <div class="range-container">
            <div class="track"></div>
            <div class="track-highlight" id="track-highlight"></div>
            <input type="range" min="0" max="100" value="0" step="0.1" class="min-slider" id="min-sr">
            <input type="range" min="0" max="100" value="10" step="0.1" class="max-slider" id="max-sr">
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

        range_slider.limit = new_limit;
        range_slider.min.setAttribute("max", new_limit);
        range_slider.max.setAttribute("max", new_limit);
        
        const min_value = parseFloat(range_slider.min.value);
        const max_value = parseFloat(range_slider.max.value);
        
        if (max_value > new_limit) {
            range_slider.max.value = new_limit;
        }
        
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

            range_slider.min.value = (max_value - 0.1).toFixed(1);
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
        slider_values.innerHTML = `(${min_value.toFixed(1)}★ - ${max_value.toFixed(1)}★)`;
        
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
            ${options.map((v, i) => {
                if (v != "all") {
                    return `<div class="dropdown-item">
                        <input type="checkbox" id="option${i}" value="${v}">
                        <label for="option${i}">${v}</label>
                    </div>
                    `     
                }
            }).join("\n")}
        </div>
        <div class="selected-options" id="selected-options"></div>
    </div>
    `;

    const dropdown_filter = {
        selected: [],
        element: create_element(html),
        callback: null
    }

    const dropdown_header = dropdown_filter.element.querySelector(".dropdown-header");
    const dropdown_content = dropdown_filter.element.querySelector(".dropdown-content");
    const selected_options = dropdown_filter.element.querySelector(".selected-options");
    const checkboxes = dropdown_filter.element.querySelectorAll(".dropdown-item input[type='checkbox']");

    dropdown_header.addEventListener("click", () => { dropdown_content.classList.toggle("show") });
    dropdown_content.addEventListener("click", (e) => { e.stopPropagation() });

    const update = () => {

        selected_options.innerHTML = "";

        checkboxes.forEach(checkbox => {

            // @TODO: rework
            if (!checkbox.checked) {

                const new_selected = [];
                for (let i = 0; i < dropdown_filter.selected.length; i++) {
                    if (dropdown_filter.selected[i] != checkbox.value) {
                        new_selected.push(dropdown_filter.selected[i]);
                    }
                }

                dropdown_filter.selected = new_selected;
                return;
            }

            if (!dropdown_filter.selected.includes(checkbox.value)) {
                dropdown_filter.selected.push(checkbox.value);
            }

            const option_tag = document.createElement("div");
            const option_text = document.createElement("span");
            const remove_btn = document.createElement("span");

            option_tag.className = "option-tag";
            remove_btn.className = "remove-option";

            option_text.textContent = checkbox.value;
            remove_btn.innerHTML = "×";

            remove_btn.addEventListener("click", function(e) {
                e.stopPropagation();
                checkbox.checked = false;
                if (dropdown_filter.callback) dropdown_filter.callback();
                update();
            });
            
            option_tag.appendChild(option_text);
            option_tag.appendChild(remove_btn);
            selected_options.appendChild(option_tag);

            if (dropdown_filter.callback) dropdown_filter.callback();
        });
    };

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener("change", update);
    });

    return dropdown_filter
};
