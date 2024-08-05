const shell = require("electron").shell;

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

const remove_popup = async (popup) => {
    popup.classList.add("removed");
    await new Promise(resolve => setTimeout(resolve, 100));
    document.body.removeChild(popup);
};

export const add_get_extra_info = (info_array) => {

    return new Promise((resolve, reject) => {

        if (!Array.isArray(info_array)) {
            reject("Invalid input: info_array should be an array");
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
                    console.log(info_array);
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
        resolve("Yes");
        remove_popup(popup);
    });

    popup.querySelector('#no-btn').addEventListener('click', () => {
        resolve("No");
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
            alert("Please enter a value");
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
            alert("Please select a file");
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
        <div class="${column ? 'popup-content-flex' : ''}">${buttons}</div>
    `;

    const popup = create_popup(content, important, resolve);

    popup.querySelectorAll('button').forEach(button => {

        button.addEventListener('click', () => {
            resolve(button.textContent);
            remove_popup(popup);
        });
    });
};

const createcustom_element = (type, defaultProps = {}) => (customProps = {}) => ({
    type,
    ...defaultProps,
    ...customProps,
});

const custom_elements = {
    small_text: createcustom_element("p", { name: "", id: "", class: "" }),
    text:       createcustom_element("h1", { name: "", id: "", class: "" }),
    input:      createcustom_element("input", { name: "", id: "", class: "" }),
    range:      createcustom_element("input", { name: "", id: "", class: "input-double-balls", min: 0, max: 1 }),
    checkbox:   createcustom_element("checkbox", { name: "", id: "", class: "" }),
    list:       createcustom_element("select", { name: "", id: "", class: "", options: [] })
};

/**
 * @param {Array<{key: string, element: Object}>} elements 
 * @param {string} id
 * @example
 * createcustomlist("test", [{ key: "age", element: { range: { min: 0, max: 100 } } }])
 * @returns {Promise<Object>}
*/
export const createcustomlist = (name, elements) => {

    return new Promise((resolve, reject) => {

        if (typeof name != "string") {
            console.log("[CUSTOM LIST] invalid name, must be a string");
            return;
        }

        if (!Array.isArray(elements)) {
            console.log("[CUSTOM LIST] invalid parameter, must be an array of objects");
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
            reject("Cancelled");
        });

        const created_elements = {};
        const range_callbacks = [];
        
        const create_label = (text, type) => {

            const label_element = document.createElement("label");

            label_element.innerHTML = text;
            label_element.style.alignSelf = type == "range" ? "center" : "start";

            return label_element;
        };

        elements.forEach(({ key: k, element: el }) => {

            const key = String(k).replace(/\s/g, '_');

            let created_element;

            const type = Object.keys(el)[0];
            const props = el[type];
            const custom_element = custom_elements[type](props);

            if (!custom_element) {
                console.log("[CUSTOM LIST] invalid type", type);
                return;
            }

            if (type == "list") {

                const options = el.list.options;

                if (!Array.isArray(options)) {
                    console.log("[CUSTOM LIST] invalid list array, must be an arrray of strings")
                    return;
                }

                const list_fragment = document.createDocumentFragment();
                const list_template = document.createElement("template");

                list_template.innerHTML = `
                    <select name="status" id="a${key}">
                        ${options.map(status => `<option value="${status}" class="${status}_list">${status}</option>`).join("")}
                    </select>
                `;

                list_fragment.appendChild(list_template.content);

                content.appendChild(create_label(k, type));
                content.appendChild(list_fragment);

                created_element = content.cloneNode(true).querySelector(`#a${key}`);
            }
            else if (type == "range") {

                const range_fragment = document.createDocumentFragment();
                const range_template = document.createElement("template");

                if (typeof custom_element.min !== 'number' || typeof custom_element.max !== 'number') {
                    console.log("[CUSTOM LIST] missing min/max", custom_element, custom_element?.min, custom_element?.max);
                    return;
                }

                if (custom_element.min == custom_element.max || custom_element.max < custom_element.min) {
                    custom_element.max = custom_element.max + 1;
                }
                
                range_template.innerHTML = `
                    <div class="input-double-balls">
                        <div class="slider-thing"></div>
                        <input type="range" name="min_${key}" id="min_${key}" min="${custom_element.min}" max="${custom_element.max}" value="${custom_element.min}">
                        <input type="range" name="max_${key}" id="max_${key}" min="${custom_element.min}" max="${custom_element.max}" value="${custom_element.max}">
                    </div>
                    <div class="input-range-text">
                            <p id="slider_min_${key}">min: ${custom_element.min}</p>
                            <p id="slider_max_${key}">max: ${custom_element.max}</p>
                    </div>
                `;

                range_fragment.appendChild(range_template.content);

                content.appendChild(create_label(k, type));
                content.appendChild(range_fragment);

                const min = content.querySelector(`#min_${key}`);
                const max = content.querySelector(`#max_${key}`)

                range_callbacks.push(function() {

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

                created_element = { min, max };
            } else {

                const type = custom_element.type == "checkbox" ? "input" : custom_element.type;

                created_element = document.createElement(type);

                created_element.className = custom_element.class;
                created_element.id = key;
                
                if (custom_element.type == "checkbox") {

                    const boxcontainer = document.createElement("div");

                    boxcontainer.className = "checkbox-container";

                    created_element.type = "checkbox";
                    created_element.innerText = k;

                    boxcontainer.appendChild(created_element);
                    boxcontainer.appendChild(create_label(k, type));

                    content.appendChild(boxcontainer);
                } else {
                    created_element.innerText = k;
                    content.appendChild(created_element);
                }
            }

            if (type == "label") {
                return;
            }

            created_elements[key] = {
                type,
                element: created_element
            }
        });

        content.innerHTML += `<button id="custom_list_submit">Submit</button>`;

        fragment.appendChild(template.content);
        document.querySelector(".container").appendChild(fragment);

        range_callbacks.forEach((callback) => callback());

        document.getElementById("custom_list_submit").addEventListener("click", () => {

            const result = {};
            
            Object.entries(created_elements).forEach(([key, { type, element: el }]) => {

                const element = document.getElementById(el.id);

                if (type === "range") {

                    result[key] = {
                        min: el.min.value,
                        max: el.max.value
                    }

                } 
                else if (type === "checkbox") {
                    result[key] = element.checked ? true : false;
                }
                else {                  
                    result[key] = type == "list" || "input" ? element.value : element.innerText;
                }
            });

            document.querySelector(".container").removeChild(popup);
            resolve(result);
        });
    });
};