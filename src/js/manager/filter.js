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
