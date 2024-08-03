const shell = require("electron").shell;

import { events } from "../tasks/events.js";

const alerts = new Map();
const max_popup_size = 6;

const alert_types = {
    error: { icon: "bi-x-circle-fill", cssClass: "alert-error" },
    success: { icon: "bi-check-circle-fill", cssClass: "alert-success" },
    warning: { icon: "bi-exclamation-triangle-fill", cssClass: "alert-warning" },
    default: { icon: "bi-exclamation-circle", cssClass: "alert-default" }
};

// TODO: fix animation not working on close
export const add_alert = async (...texts) => {

    let deleted = false;

    const options = {
        type: "default",
        append_html: false,
        test: false,
        seconds: 3,
        text: texts.filter(t => typeof t === "string" || typeof t === "number").join(" ")
    };

    texts.forEach(t => {

        if (typeof t === "object") {
            Object.assign(options, t);
        }
    });

    if (alerts.size > max_popup_size) {
        console.log("Too many popups");
        return;
    }

    const id = Date.now();
    const div = document.createElement("div");

    const alert_icon = document.createElement("i");
    const alert_text = document.createElement("h2");
    const alert_close = document.createElement("i");
    const alert_type = alert_types[options.type] || alert_types.default;

    div.classList.add("alert-popup", alert_type.cssClass);
    div.id = id;

    alert_icon.classList.add("bi", alert_type.icon, "alert-icon");
    alert_close.classList.add("bi", "bi-x", "alert-close");

    if (options.append_html) {
        alert_text.innerHTML = options.text;
    } else {
        alert_text.innerText = options.text;
    }

    div.append(alert_icon, alert_text, alert_close);
    alerts.set(id, div);

    document.querySelector(".alert-container").appendChild(div);

    alert_close.addEventListener("click", () => {
        remove_alert(div, id);
        deleted = true;
    });

    if (options.append_html) {

        div.querySelectorAll('a[href^="http"]').forEach(a => {
            
            a.addEventListener("click", e => {
                e.preventDefault();
                shell.openExternal(e.target.href);
            });
        });
    }

    if (options.test) {
        return;
    }

    await new Promise(resolve => setTimeout(resolve, options.seconds * 1000));

    if (!deleted) {
        div.classList.add("fade-out");
        setTimeout(() => remove_alert(div, id), 500);
    }
};

export const remove_alert = (div, id) => {
    
    if (!id || !div) {
        console.log("Invalid id/div", id, div);
        return;
    }

    alerts.delete(id);

    document.querySelector(".alert-container").removeChild(div);
};

export const add_get_extra_info = (infoArray) => {

    return new Promise((resolve, reject) => {

        if (!Array.isArray(infoArray)) {
            reject("Invalid input: infoArray should be an array");
            return;
        }

        infoArray.forEach(info => {

            const important  = info?.important ? info.important : false,
                  column     = info?.column ? info.column : false,
                  input_type = info?.input_type ? info.input_type : false,
                  title      = info?.title ? info.title : false;

            if (info.type === 'confirmation' && info.text) {
                createConfirmationPopup(info.text, resolve, important);
            } 
            else if (info.type === 'list' && Array.isArray(info.value)) {
                createListPopup(info.value, resolve, important, column, title);
            } 
            else if (info.type == "input" && info.text) {
                createInputPopup(info.text, resolve, important, input_type);
            }
            else if (info.type == "file" && info.text) {
                createFilePopup(info.text, resolve, important);
            }
            else {
                console.log(infoArray);
                reject("Invalid object in array");
            }
        });
    });
};

const remove_popup = async (popup) => {
    popup.classList.add("removed");
    await new Promise(resolve => setTimeout(resolve, 100));
    document.body.removeChild(popup);
};

const createConfirmationPopup = (text, resolve, important) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    const header = document.createElement("h1");
    header.innerText = text;
    content.appendChild(header);

    const yesButton = document.createElement("button");
    yesButton.innerText = "Yes";

    yesButton.addEventListener("click", () => {
        resolve("Yes");
        remove_popup(div);
    });

    const noButton = document.createElement("button");
    noButton.innerText = "No";

    noButton.addEventListener("click", () => {
        resolve("No");
        remove_popup(div);
    });

    content.appendChild(yesButton);
    content.appendChild(noButton);

    div.appendChild(content);

    document.body.appendChild(div);

    if (!important) {
        div.addEventListener("click", (event) => {
            if (event.target === div) {
                remove_popup(div);
                resolve(null);
            }
        });
    }
};

const createInputPopup = (text, resolve, important, type) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    const header = document.createElement("h1");
    header.innerText = text;
    content.appendChild(header);

    const input = document.createElement("input");
    input.type = type ? type : "text";
    content.appendChild(input);

    const submitButton = document.createElement("button");
    submitButton.innerText = "Submit";
    submitButton.addEventListener("click", () => {

        if (!input.value) {
            alert("Please enter a value");
            return;
        }

        resolve(input.value);
        remove_popup(div); 
    });

    content.appendChild(submitButton);
    div.appendChild(content);
    document.body.appendChild(div);

    if (important) {
        return;
    }

    div.addEventListener("click", (event) => {
        if (event.target === div) {
            remove_popup(div);
            resolve(null);
        }
    });
};

const createFilePopup = (text, resolve, important) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    const header = document.createElement("h1");
    header.innerText = text;
    content.appendChild(header);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept =".json";
    content.appendChild(fileInput);

    const submitButton = document.createElement("button");
    submitButton.innerText = "Submit";
    submitButton.addEventListener("click", () => {
        if (fileInput.files.length > 0) {
            resolve(fileInput.files[0]);
            remove_popup(div);
        } else {
            alert("Please select a file");
        }
    });

    content.appendChild(submitButton);
    div.appendChild(content);
    document.body.appendChild(div);

    if (important) {
        return;
    }

    div.addEventListener("click", (event) => {
        if (event.target === div) {
            remove_popup(div);
            resolve(null);
        }
    });
};

const createListPopup = (values, resolve, important, column, title) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    if (column) {
        content.classList.add("popup-content-flex");
    }

    const header = document.createElement("h1");
    header.innerText = title ? title : "Select an option:";
    content.appendChild(header);

    values.forEach(value => {
        const button = document.createElement("button");
        button.innerText = value;
        button.addEventListener("click", () => {
            resolve(value);
            remove_popup(div);
        });
        content.appendChild(button);
    });

    div.appendChild(content);
    document.body.appendChild(div);

    if (!important) {
        div.addEventListener("click", (event) => {
            if (event.target === div) {
                remove_popup(div);
                resolve(null);
            }
        });
    }
};

const createcustom_element = (type, defaultProps = {}) => (customProps = {}) => ({
    type,
    ...defaultProps,
    ...customProps,
});

const custom_elements = {
    div:        createcustom_element("div", { name: "", id: "", class: "" }),
    label:      createcustom_element("label", { name: "", id: "", class: "" }),
    small_text: createcustom_element("p", { name: "", id: "", class: "" }),
    text:       createcustom_element("h1", { name: "", id: "", class: "" }),
    input:      createcustom_element("input", { name: "", id: "", class: "" }),
    range:      createcustom_element("input", { name: "", id: "", class: "input-double-balls", min: 0, max: 1 })
};

/**
 * @param {Array<{key: string, element: Object}>} elements 
 * @param {string} id
 * @returns {Promise<Object>}
 */
// TODO: implement this in the remove_maps function
export const createcustomlist = (name, elements, id) => {

    return new Promise((resolve, reject) => {

        if (typeof name != "string") {
            console.log("[CUSTOM LIST] invalid name, must be a string");
        }

        if (!Array.isArray(elements)) {
            console.log("[CUSTOM LIST] invalid parameter, must be an array of objects");
            reject("Invalid parameter");
            return;
        }

        const fragment = document.createDocumentFragment();
        const template = document.createElement('template');

        template.innerHTML = `
            <div class="popup-container">
                <div class="popup-content-flex">
                    <h1>${name}</h1>
                </div>
            </div>
        `;

        const content = template.content.querySelector(".popup-content-flex");
        const popup   = template.content.querySelector(".popup-container");

        popup.addEventListener("click", (event) => {
            
            if (event.target !== popup) {
                return;
            }

            document.querySelector(".container").removeChild(popup);
            events.emit("progress-end", id);
            reject("Cancelled");
        });

        const created_elements = {};

        elements.forEach(({ key, element: el }) => {

            const type = Object.keys(el)[0];
            const props = el[type];
            const custom_element = custom_elements[type](props);

            if (!custom_element) {
                console.log("[CUSTOM LIST] invalid type", type);
                return;
            }

            const label_element = document.createElement("label");

            label_element.innerHTML = key;
            label_element.style.alignSelf = type == "range" ? "center" : "start";

            content.appendChild(label_element);

            let created_element;

            if (type === "range") {

                const range_fragment = document.createDocumentFragment();
                const range_template = document.createElement("template");

                if (typeof custom_element.min !== 'number' || typeof custom_element.max !== 'number') {
                    console.log("[CUSTOM LIST] missing min/max", custom_element, custom_element?.min, custom_element?.max);
                    return;
                }
                
                range_template.innerHTML = `
                    <div class="input-double-balls">
                        <div class="slider-thing"></div>
                        <input type="range" name="${key}_min" id="${key}_min" min="${custom_element.min}" max="${custom_element.max}" value="${custom_element.min}">
                        <input type="range" name="${key}_max" id="${key}_max" min="${custom_element.min}" max="${custom_element.max}" value="${custom_element.max}">
                    </div>
                    <div class="input-range-text">
                            <p id="${key}_slider_min">min: ${custom_element.min}</p>
                            <p id="${key}_slider_max">max: ${custom_element.max}</p>
                    </div>
                `;

                range_fragment.appendChild(range_template.content);
                content.appendChild(range_fragment);

                const min = content.querySelector(`#${key}_min`);
                const max = content.querySelector(`#${key}_max`);

                const slider_min = content.querySelector(`#${key}_slider_min`);
                const slider_max = content.querySelector(`#${key}_slider_max`);
                
                min.addEventListener('input', () => {

                    if (parseInt(min.value) > parseInt(max.value)) {
                        min.value = max.value;
                    }

                    slider_min.innerText = `min: ${min.value}`;
                });
        
                max.addEventListener('input', () => {

                    if (parseInt(max.value) < parseInt(min.value)) {
                        max.value = min.value;
                    }

                    slider_max.innerText = `max: ${max.value}`;
                });

                created_element = { min, max };
            } else {

                created_element = document.createElement(custom_element.type);

                created_element.className = custom_element.class;
                created_element.id = key;
                created_element.innerText = custom_element.name;

                content.appendChild(created_element);
            }

            if (type == "label") {
                return;
            }

            created_elements[key] = {
                type,
                element: created_element
            };
        });

        content.innerHTML += `<button id="custom_list_submit">Submit</button>`;

        fragment.appendChild(template.content);
        document.querySelector(".container").appendChild(fragment);

        document.getElementById("custom_list_submit").addEventListener("click", () => {

            const result = {};
            
            Object.entries(created_elements).forEach(([key, { type, element }]) => {

                if (type === "range") {

                    result[key] = {
                        min: element.min.value,
                        max: element.max.value
                    };
                } else {
                    result[key] = element.value || element.innerText;
                }
            });

            document.querySelector(".container").removeChild(popup);
            resolve(result);
        });
    });
};

export const createCustomList = (status, id) => {

    return new Promise((resolve, reject) => {

        const html = 
        `
            <div class="popup-container">
                <div class="popup-content-flex" style="flex-direction: column;">
                    <h1>Options</h1>
                    <div class="input-double-balls" style="display: none;">
                        <div class="slider-thing"></div>
                        <input type="range" name="ball0" id="min_sr" min="0" max="30" value="0">
                        <input type="range" name="ball1" id="max_sr" min="0" max="30" value="10">
                        <p class="slider1">min: 0</p>
                        <p class="slider2">max: 10</p>
                    </div>
                    <label for="status">Status</label>
                    <select name="status" id="status">
                        ${status.map(status => `<option value="${status}">${status}</option>`)}
                    </select>
                    <div style="display: flex; width: 100%; align-items: center; flex-direction: column; justify-content: center; margin: 0;">
                        <div class="checkbox-container">
                            <input type="checkbox" id="piru" name="piru"></input>
                            <label for="piru" style="margin: 0; margin-left: 2px;">Enable star rating check</label>
                        </div>    

                        <div class="checkbox-container">
                            <input type="checkbox" id="exclude_collections" name="exclude_collections"></input>
                            <label for="exclude_collections">Ignore Beatmaps from Collections</label>
                        </div>  

                    </div>
                    <button id="custom_list_submit">Submit</button>
                </div>
            </div>
        `;

        document.querySelector(".container").insertAdjacentHTML("beforebegin", html);

        const min_sr = document.getElementById('min_sr');
        const max_sr = document.getElementById('max_sr');

        const slider1 = document.querySelector('.slider1');
        const slider2 = document.querySelector('.slider2');

        slider1.innerText = `min: ${min_sr.value}`;
        slider2.innerText = `max: ${max_sr.value}`;

        const enable_sr = document.getElementById('piru');
        
        let sr_enabled = false;

        enable_sr.addEventListener('change', () => {

            sr_enabled = enable_sr.checked;

            if (enable_sr.checked) {
                document.querySelector(".input-double-balls").style.display = "flex";
            } else {
                document.querySelector(".input-double-balls").style.display = "none";
            }
        });

        min_sr.addEventListener('input', () => {

            if (parseInt(min_sr.value) > parseInt(max_sr.value)) {
                min_sr.value = max_sr.value;
            }

            slider1.innerText = `min: ${min_sr.value}`;
        });

        max_sr.addEventListener('input', () => {

            if (parseInt(max_sr.value) < parseInt(min_sr.value)) {
                max_sr.value = min_sr.value;
            }

            slider2.innerText = `max: ${max_sr.value}`;
        });

        document.getElementById("custom_list_submit").addEventListener("click", () => {

            const div = document.querySelector(".popup-container");

            const status = document.getElementById("status").value;
            const exclude_collections = document.getElementById("exclude_collections").checked;

            if (min_sr.value == "0" && max_sr.value == "0") {
                add_alert("min sr and max sr cannot be both 0", { type: "warning" });
                return;
            }

            resolve({ min_sr: parseInt(min_sr.value), max_sr: parseInt(max_sr.value), status, exclude_collections, sr_enabled });
            remove_popup(div);
        });

        const div = document.querySelector(".popup-container");
        div.addEventListener("click", (event) => {
            if (event.target === div) {
                remove_popup(div);
                events.emit("progress-end", id);
                reject("Cancelled");
            }
        });
    });
};