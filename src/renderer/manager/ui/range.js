import { safe_id, create_element, debounce } from "../../utils/global.js";

export const create_range = (options = { id: crypto.randomUUID(), text: "range", iden: "", fix: 2, initial: 0 }) => {

    if (isNaN(Number(options.initial))) {
        create_alert("failed to create dropdown...", { type: "error" });
        return;
    }

    const element = create_element(`
        <div class="slider-container" id="${safe_id(options.id)}">
            <div class="slider-header">
                <span class="slider-label"></span>
                <span class="slider-values" id="slider-values">(0.0${options.iden} - ${options.initial}.0${options.iden})</span>
            </div>
            <div class="range-container">
                <div class="track"></div>
                <div class="track-highlight" id="track-highlight"></div>
                <input type="range" min="0" max="${options.initial}" value="0" step="0.01" class="min-slider" id="min-sr">
                <input type="range" min="0" max="${options.initial}" value="${options.initial}" step="0.01" class="max-slider" id="max-sr">
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
        set_limit: null,
        set_callback: (c) => range_slider.callback = c 
    }
    
    const slider_label = element.querySelector(".slider-label");
    const slider_values = element.querySelector(".slider-values");
    const track_highlight = element.querySelector("#track-highlight");

    slider_values.textContent = `(0.0${options.iden} - ${options.initial}.0${options.iden})`;
    slider_label.textContent = options.text;
    
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

    const set_limit = (new_limit, ignore) => {

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

    const update = (ignore) => {

        let min_value = parseFloat(range_slider.min.value);
        let max_value = parseFloat(range_slider.max.value);
        
        // prevent min exceeding max
        if (min_value >= max_value) {

            if (min_value - 0.1 < 0) {
                return;
            }

            range_slider.min.value = (max_value - 0.1).toFixed(options.fix);
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
        slider_values.textContent = `(${min_value.toFixed(options.fix)}${options.iden} - ${max_value.toFixed(options.fix)}${options.iden})`;
        
        // update tracker
        const min_percent = (min_value / range_slider.limit) * 100;
        const max_percent = (max_value / range_slider.limit) * 100;
        const width_percent = max_percent - min_percent;
        
        track_highlight.style.width = `${width_percent}%`;
        track_highlight.style.left = `${min_percent}%`;
        
        force_update();
        if (!ignore && range_slider.callback) debounce(range_slider.callback);
    };
    
    set_limit(range_slider.limit, true);

    range_slider.update = update;
    range_slider.set_limit = set_limit;

    range_slider.min.addEventListener("input", update);
    range_slider.max.addEventListener("input", update);

    return range_slider;
};
