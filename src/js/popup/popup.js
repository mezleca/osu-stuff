import { create_dropdown_filter, create_range_filter } from "../manager/ui/filter.js";
import { create_element } from "../utils/config.js";

const alerts = new Map();

const DEFAULT_ALERT_OBJECT = {
    type: "default",
    html: true,
    seconds: 3,
    text: ""
}

const MESSAGE_TYPES = {
    MENU: 'menu',
    CUSTOM_MENU: 'custom_menu',
    INPUT: "input",
    CONFIRMATION: "confirmation"
};

const ALERT_STYLES = {
    error: { icon: "bi-x-circle-fill", class: "alert-error" },
    success: { icon: "bi-check-circle-fill", class: "alert-success" },
    warning: { icon: "bi-exclamation-triangle-fill", class: "alert-warning" },
    default: { icon: "bi-exclamation-circle", class: "alert-default" }
};

export const create_custom_popup = async (config) => {
    
    const { type, ...options } = config;
    
    if (!type) {
        throw new Error("[create_custom_popup] missing type");
    }

    switch (type) {
        case MESSAGE_TYPES.MENU:
            return create_menu(options);
        case MESSAGE_TYPES.CUSTOM_MENU:
            return create_custom_menu(options);
        case MESSAGE_TYPES.INPUT:
            return create_input(options);
        case MESSAGE_TYPES.CONFIRMATION:
            return create_confirmation(options);
        default:
            return null;
    }
};

export const create_alert = async (text, data) => {

    const options = data ? data : {...DEFAULT_ALERT_OBJECT, text: text };
    const seconds = options?.seconds ? options.seconds : 3;

    const alert_style = ALERT_STYLES[options.type] || ALERT_STYLES["default"];
    const alert_id = crypto.randomUUID();
    const alert_text = text;

    if (!alert_style || !alert_text) {
        throw new Error("[ALERT]: missing option");
    }

    const html = `
        <div class="alert-popup ${alert_style.class}">
            <i class="alert-icon ${alert_style.icon}"></i>
            <h2>${alert_text}</h2>
            <i class="bi bi-x alert-close" id="${alert_id}"></i>
        </div>
    `;

    const content = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
    const container = document.querySelector(".alert-container");

    container.appendChild(content);
    content.classList.toggle("start");

    if (options.html) {
        content.querySelectorAll('a[href^="http"]').forEach((a) => {     
            a.addEventListener("click", (element) => {
                element.preventDefault();
                window.electron.shell.openExternal(element.target.href);
            });
        });
    }

    const remove_alert = () => {
        if (!alerts.get(alert_id)) {
            return;
        }
        alerts.delete(alert_id);
        content.classList.toggle("end");
        setTimeout(() => container.removeChild(content), 500);
    }

    alerts.set(alert_id, content);
    document.getElementById(alert_id).addEventListener("click", remove_alert);

    setTimeout(remove_alert, seconds * 1000);
};

const create_input = async (options) => {

    const { label = 'input:', input_type = 'text' } = options;
    const input_id = crypto.randomUUID();

    const html = `
        <div class="popup-container" id="${input_id}">
            <div class="popup-content">
                <label>${label}</label>
                <input type="${input_type}" id="input_field" value="${options?.value || ""}">
                <button id="input_submit">Submit</button>
            </div>
        </div>
    `;

    const content = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;

    document.body.appendChild(content);

    return new Promise((resolve) => {
        const input = content.querySelector("#input_field");
        const submit = content.querySelector("#input_submit");

        submit.addEventListener("click", () => {
            document.body.removeChild(content);
            resolve(input.value);
        });

        content.addEventListener("click", (e) => {
            if (e.target.classList.contains("popup-container")) {
                document.body.removeChild(content);
                resolve(null);
            }
        });
    });
};

const create_menu = async (options) => {

    const { title = 'select an option:', items = [], important = false } = options;
    const menu_id = crypto.randomUUID();

    const html = `
        <div class="popup-container" id="${menu_id}">
            <div class="popup-content">
                <h1>${title}</h1>
                <div class="popup-buttons">
                    ${items.map(item => `<button>${item}</button>`).join('')}
                </div>
            </div>
        </div>
    `;

    const content = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
    document.body.appendChild(content);

    return new Promise((resolve) => {
        if (!important) {
            content.addEventListener("click", (e) => {
                if (e.target.classList.contains("popup-container")) {
                    document.body.removeChild(content);
                    resolve(null);
                }
            });
        }

        content.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                document.body.removeChild(content);
                resolve(button.textContent);
            });
        });
    });
};

const create_confirmation = async (options) => {

    const { title = 'Are you sure?', values } = options;

    const confirmation_id = crypto.randomUUID();
    const confirm_values = Array.isArray(values) && values.length ? values : ['Yes', 'No'];

    const html = `
        <div class="popup-container" id="${confirmation_id}">
            <div class="popup-content">
                <h1>${title}</h1>
                <div class="popup-buttons">
                    ${confirm_values.map(value => `<button>${value}</button>`).join('')}
                </div>
            </div>
        </div>
    `;

    const content = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
    document.body.appendChild(content);

    return new Promise((resolve) => {
        content.querySelectorAll('button').forEach(button => {
            button.addEventListener("click", () => {
                document.body.removeChild(content);
                resolve(button.textContent);
            });
        });

        content.addEventListener("click", (e) => {
            if (e.target.classList.contains("popup-container")) {
                document.body.removeChild(content);
                resolve(null);
            }
        });
    });
};

export const quick_confirm = async (title) => {
    const confirm = await create_custom_popup({ type: message_types.CONFIRMATION, title: title });
    return confirm == "Yes";
};

const create_custom_menu = async (options) => {

    const { title, elements = [] } = options;
    const menu_id = crypto.randomUUID();
    const filters = {};
    
    const container = document.querySelector(".container");
    const content_wrapper = create_element(`
        <div class="popup-container" id="${menu_id}">
            <div class="popup-content-flex">
                <h1>${title}</h1>
                <div id="elements_container"></div>
                <button id="custom_menu_submit">submit</button>
            </div>
        </div>
    `);
    
    const elements_container = content_wrapper.querySelector("#elements_container");
    
    elements.forEach(({ key, element }) => {

        const type = Object.keys(element)[0];
        const props = element[type]?.options ? element[type].options : element[type];
        const label = element[type]?.label || key;
        const safe_key = key.replace(/\s+/g, '_');

        switch (type) {
            case 'list':

                const is_multiple = element[type]?.multiple == true;
                
                if (is_multiple) {
                    const dropdown = create_dropdown_filter(`${safe_key}_dropdown`, label, props);
                    filters[safe_key] = dropdown;
                    elements_container.appendChild(dropdown.element);
                } else {
                    const select_el = create_element(`
                        <div class="select-container">
                            <label>${label}</label>
                            <select id="${safe_key}">
                                ${props.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                            </select>
                        </div>
                    `);
                    elements_container.appendChild(select_el);
                }
                break;
                
            case 'range':
                const iden = props.identifier || '';
                const fix = props.decimal_places || 2;
                const initial = props.max || 100;
                const range = create_range_filter(`${safe_key}_range`, label, iden, fix, initial);
                filters[safe_key] = range;
                elements_container.appendChild(range.element);
                break;
                
            case 'checkbox':
                const checkbox_el = create_element(`
                    <div class="checkbox-container">
                        <input type="checkbox" id="${safe_key}">
                        <label for="${safe_key}">${label}</label>
                    </div>
                `);
                elements_container.appendChild(checkbox_el);
                break;
                
            default:
                const default_el = create_element(`
                    <div class="input-container">
                        <label>${label}</label>
                        <${type} type="text" id="${safe_key}">${props.text || ''}</${type}>
                    </div>
                `);
                elements_container.appendChild(default_el);
                break;
        }
    });
    
    container.appendChild(content_wrapper);
    
    return new Promise((resolve, reject) => {

        const submit_btn = content_wrapper.querySelector("#custom_menu_submit");
        submit_btn.addEventListener("click", () => {

            const result = {};
            
            elements.forEach(({ key, element }) => {

                const type = Object.keys(element)[0];
                const safe_key = key.replace(/\s+/g, '_');
                const is_multiple = type == 'list' && element[type]?.multiple == true;
                
                if (type == 'range') {
                    const range_filter = filters[safe_key];
                    if (range_filter) {
                        result[safe_key] = {
                            min: parseFloat(range_filter.min.value),
                            max: parseFloat(range_filter.max.value)
                        };
                    }
                } else if (type == 'list') {
                    if (is_multiple) {
                        const dropdown_filter = filters[safe_key];
                        if (dropdown_filter) {
                            result[safe_key] = dropdown_filter.selected;
                        }
                    } else {
                        const select_el = content_wrapper.querySelector(`#${safe_key}`);
                        if (select_el) {
                            result[safe_key] = select_el.value;
                        }
                    }
                } else if (type == 'checkbox') {
                    const checkbox = content_wrapper.querySelector(`#${safe_key}`);
                    if (checkbox) {
                        result[safe_key] = checkbox.checked;
                    }
                } else {
                    const el = content_wrapper.querySelector(`#${safe_key}`);
                    if (el) {
                        result[safe_key] = el.value || el.textContent;
                    }
                }
            });
            
            container.removeChild(content_wrapper);
            resolve(result);
        });
        
        content_wrapper.addEventListener("click", (e) => {
            if (e.target == content_wrapper) {
                container.removeChild(content_wrapper);
                reject(null);
            }
        });
    });
};

export const message_types = MESSAGE_TYPES;
