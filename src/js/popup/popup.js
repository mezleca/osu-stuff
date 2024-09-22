import { blink } from "../tabs.js";

const shell = require("electron").shell;

const alerts = new Map();
const max_popup_size = 6;

const alert_types = {
    error: { icon: "bi-x-circle-fill", cssClass: "alert-error" },
    success: { icon: "bi-check-circle-fill", cssClass: "alert-success" },
    alert: { icon: "bi-exclamation-triangle-fill", cssClass: "alert-warning" },
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

    if (options?.blink) {
        blink(options.blink);
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

    console.log("[ALERT]:", options.text);

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

const remove_popup = async (popup) => {
    popup.classList.add("removed");
    await new Promise(resolve => setTimeout(resolve, 100));
    document.body.removeChild(popup);
};

export const add_get_extra_info = (info_array) => {

    return new Promise((resolve, reject) => {

        if (!Array.isArray(info_array)) {
            reject("[ADD EXTRA INFO] info_array should be an array");
            return;
        }
  
        info_array.forEach(info => {

            const { important = false, column = false, input_type = false, title = false } = info;
    
            switch (info.type) {
                case 'confirmation':
                    if (info.text) {
                        create_confirmation_popup(info.text, resolve, important);
                    }
                    break;
                case 'list':
                    if (Array.isArray(info.value)) {
                        create_list_popup(info.value, resolve, important, column, title);
                    }
                    break;
                case 'input':
                    if (info.text) {
                        create_input_popup(info.text, resolve, important, input_type);
                    }
                    break;
                case 'file':
                    if (info.text) {
                        create_file_popup(info.text, resolve, important);
                    }
                    break;
                default:
                    console.log("[ADD EXTRA INFO] Invalid object in array");
                    reject("Invalid object in array");
            }
        });
    });
};
  
const create_popup = (content, important, resolve) => {

    const template = document.createElement('template');

    template.innerHTML = `
        <div class="popup-container">
            <div class="popup-content">
            ${content}
            </div>
        </div>
    `;

    const popup = template.content.firstElementChild;
    document.body.appendChild(popup);

    if (!important) {

        popup.addEventListener("click", (event) => {

            if (event.target != popup) {
                return;
            }

            remove_popup(popup);
            resolve(null);
        });
    }

    return popup;
};

const create_confirmation_popup = (text, resolve, important) => {

    const content = `
        <h1>${text}</h1>
        <button id="yes-btn">Yes</button>
        <button id="no-btn">No</button>
    `;

    const popup = create_popup(content, important, resolve);

    popup.querySelector('#yes-btn').addEventListener('click', () => {
        resolve(true);
        remove_popup(popup);
    });

    popup.querySelector('#no-btn').addEventListener('click', () => {
        resolve(false);
        remove_popup(popup);
    });
};

const create_input_popup = (text, resolve, important, type) => {

    const content = `
        <h1>${text}</h1>
        <input type="${type || 'text'}" id="input-field">
        <button id="submit-btn">Submit</button>
    `;

    const popup = create_popup(content, important, resolve);

    popup.querySelector('#submit-btn').addEventListener('click', () => {

        const input = popup.querySelector('#input-field');

        if (!input.value) {
            add_alert("please enter a value");
            return;
        }

        resolve(input.value);
        remove_popup(popup);
    });
};

const create_file_popup = (text, resolve, important) => {

    const content = `
        <h1>${text}</h1>
        <input type="file" accept=".json" id="file-input">
        <button id="submit-btn">Submit</button>
    `;

    const popup = create_popup(content, important, resolve);

    popup.querySelector('#submit-btn').addEventListener('click', () => {

        const fileInput = popup.querySelector('#file-input');

        if (fileInput.files.length == 0) {
            add_alert("Please select a file");
            return;
        }

        resolve(fileInput.files[0]);
        remove_popup(popup);
    });
};

const create_list_popup = (values, resolve, important, column, title) => {
    
    const buttons = values.map(value => `<button>${value}</button>`).join('');
    const content = `
        <h1>${title || 'Select an option:'}</h1>
        <div class="${column ? 'popup-buttons-column' : 'popup-buttons'}">${buttons}</div>
    `;

    const popup = create_popup(content, important, resolve);

    popup.querySelectorAll('button').forEach(button => {

        button.addEventListener('click', () => {
            resolve(button.textContent);
            remove_popup(popup);
        });
    });
};

const valid_elements = {
    small_text: { name: String, id: String, class: String },
    text:       { name: String, id: String, class: String },
    input:      { name: String, id: String, class: String },
    range:      { name: String, id: String, class: String, min: Number, max: Number },
    checkbox:   { name: String, id: String, class: String },
    list:       { name: String, id: String, class: String },
};

/**
 * @param {string} id
 * @param {Array<{key: string, element: {[K in keyof typeof valid_elements]: typeof valid_elements[K]}}>} elements
 * @example
 * createcustomlist("test", [
 *   { 
 *     key: "123123", 
 *     element: { 
 *       range: { name: "age", id: "age-range", min: 0, max: 20 }
 *     }
 *   }
 * ])
 * @returns {Promise<Object>}
*/
export const createcustomlist = (name, elements) => {

    return new Promise((resolve, reject) => {

        if (typeof name !== "string") {
            console.log("[CUSTOM LIST] invalid name, must be a string");
            return;
        }

        if (!Array.isArray(elements)) {
            console.log("[CUSTOM LIST] invalid parameter, must be an array of objects");
            return;
        }

        const post_callbacks = [];

        const create_popup = () => {

            const template = document.createElement('template');
            template.innerHTML = `
                <div class="popup-container">
                    <div class="popup-content-flex">
                        <h1>${name}</h1>
                    </div>
                </div>
            `;
            return template.content.firstElementChild;
        };

        const create_label = (text, type) => {

            const label_element = document.createElement("label");
            label_element.textContent = text;
            label_element.style.alignSelf = type === "range" ? "center" : "start";
            return label_element;
        };

        const create_list_element = (key, options) => {

            const select = document.createElement("select");
            select.id = `a${key}`;
            select.name = "status";
            options.forEach(status => {
                const option = document.createElement("option");
                option.value = status;
                option.textContent = status;
                option.className = `${status}_list`;
                select.appendChild(option);
            });
            return select;
        };

        const create_range_element = (key, min, max) => {

            const container = document.createElement("div");

            container.style = "display: flex; flex-direction: column;";

            container.innerHTML = `
                <div class="input-double-balls">
                    <div class="slider-thing"></div>
                    <input type="range" name="min_${key}" id="min_${key}" min="${min}" max="${max}" value="${min}">
                    <input type="range" name="max_${key}" id="max_${key}" min="${min}" max="${max}" value="${max}">
                </div>
                <div class="input-range-text">
                    <p id="slider_min_${key}">min: ${min}</p>
                    <p id="slider_max_${key}">max: ${max}</p>
                </div>
            `;

            post_callbacks.push(function() {

                const min = document.querySelector(`#min_${key}`);
                const max = document.querySelector(`#max_${key}`)

                const slider_min = document.querySelector(`#slider_min_${key}`);
                const slider_max = document.querySelector(`#slider_max_${key}`);

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
            });

            return container;
        };

        const popup = create_popup();
        const content = popup.querySelector(".popup-content-flex");
        const created_elements = {};

        popup.addEventListener("click", (event) => {

            if (event.target != popup) {
                return;
            }

            document.querySelector(".container").removeChild(popup);
            reject("Cancelled");
        });

        elements.forEach(({ key: k, element: el }) => {

            const key = String(k).replace(/\s/g, '_');
            const type = Object.keys(el)[0];
            const props = el[type];

            let created_element;

            switch (type) {
                case "list":
                    created_element = create_list_element(key, props.options);
                    break;
                case "range":
                    created_element = create_range_element(key, props.min, props.max);
                    break;
                case "checkbox":
                    created_element = document.createElement("input");
                    created_element.type = "checkbox";
                    created_element.id = key;
                    const boxcontainer = document.createElement("div");
                    boxcontainer.className = "checkbox-container";
                    boxcontainer.appendChild(created_element);
                    boxcontainer.appendChild(create_label(k, type));
                    content.appendChild(boxcontainer);
                    break;
                default:
                    created_element = document.createElement(type);
                    created_element.id = key;
                    created_element.className = props.class;
                    created_element.textContent = k;
                    break;
            }

            if (type !== "checkbox") {
                content.appendChild(create_label(k, type));
                content.appendChild(created_element);
            }

            if (type !== "label") {
                created_elements[key] = { type, element: created_element };
            }
        });

        const submit_button = document.createElement("button");

        submit_button.id = "custom_list_submit";
        submit_button.textContent = "Submit";

        content.appendChild(submit_button);
        document.querySelector(".container").appendChild(popup);

        post_callbacks.forEach((cb) => cb());

        submit_button.addEventListener("click", () => {

            const result = {};
            
            Object.entries(created_elements).forEach(([key, { type, element }]) => {

                const el = document.getElementById(element.id);

                if (type === "range") {
                    result[key] = {
                        min: document.querySelector(`#min_${key}`).value,
                        max: document.querySelector(`#max_${key}`).value
                    };
                } else if (type === "checkbox") {
                    result[key] = el.checked;
                } else {
                    result[key] = el.value || el.textContent;
                }
            });

            document.querySelector(".container").removeChild(popup);
            resolve(result);
        });
    });
};