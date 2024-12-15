// TODO: the code is kinda "better" but its not readable at all in some cases like (simple list, etc...).

const DEFAULT_ALERT_OBJECT = {
    type: "default",
    html: true,
    seconds: 3,
    text: ""
}

const MESSAGE_TYPES = {
    MENU: 'menu',
    CUSTOM_MENU: 'custom_menu',
    INPUT: "input"
};

const ALERT_STYLES = {
    error: { icon: "bi-x-circle-fill", class: "alert-error" },
    success: { icon: "bi-check-circle-fill", class: "alert-success" },
    warning: { icon: "bi-exclamation-triangle-fill", class: "alert-warning" },
    default: { icon: "bi-exclamation-circle", class: "alert-default" }
};

const alerts = new Map();

export const create_custom_message = async (config) => {
    
    const { type, ...options } = config;
    
    if (!type) {
        throw new Error("[create_custom_message] missing type");
    }

    switch (type) {
        case MESSAGE_TYPES.MENU:
            return create_menu(options);
        case MESSAGE_TYPES.CUSTOM_MENU:
            return create_custom_menu(options);
        case MESSAGE_TYPES.INPUT:
            return create_input(options);
    }
};

export const create_alert = async (text, data) => {

    const options = data ? data : {...DEFAULT_ALERT_OBJECT, text: text };
    const seconds = options?.seconds ? options.seconds : 3;

    const alert_style = ALERT_STYLES[options.alert_mode] || ALERT_STYLES["default"];
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
                <input type="${input_type}" id="input_field">
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
            if (e.target === content) {
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
                if (e.target === content) {
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

const create_custom_menu = async (options) => {

    const { title, elements = [] } = options;
    const menu_id = crypto.randomUUID();

    const create_element = (key, config, label) => {

        const type = Object.keys(config)[0];
        const props = config[type]?.options ? config[type].options : config[type];
        const safe_key = key.replace(/\s+/g, '_');

        switch (type) {
            case 'list':
                return `
                    <label>${label ? label : key}</label>
                    <select id="${safe_key}">
                        ${props.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                `;
            case 'range':
                return `
                    <label>${label ? label : key}</label>
                    <div class="input-double-balls">
                        <div class="slider-thing"></div>
                        <input type="range" id="min_${safe_key}" min="${props.min}" max="${props.max}" value="${props.min}">
                        <input type="range" id="max_${safe_key}" min="${props.min}" max="${props.max}" value="${props.max}">
                    </div>
                    <div class="input-range-text">
                        <p id="slider_min_${safe_key}">min: ${props.min}</p>
                        <p id="slider_max_${safe_key}">max: ${props.max}</p>
                    </div>
                `;
            case 'checkbox':
                return `
                    <div class="checkbox-container">
                        <input type="checkbox" id="${safe_key}">
                        <label for="${safe_key}">${label ? label : key}</label>
                    </div>
                `;
            default:
                return `
                    <label>${label ? label : key}</label>
                    <${type} id="${safe_key}">${props.text || ''}</${type}>
                `;
        }
    };

    const html_elements = elements.map(({ key, element }) => {
        const label = Object.values(element).find(value => value?.label)?.label; // ...
        return create_element(key, element, label);
    }).join("");

    const html = `
        <div class="popup-container" id="${menu_id}">
            <div class="popup-content-flex">
                <h1>${title}</h1>
                ${html_elements}
                <button id="custom_menu_submit">Submit</button>
            </div>
        </div>
    `;

    const content = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;

    const container = document.querySelector(".container");
    container.appendChild(content);

    const setup_range_listeners = () => {
        elements.forEach(({ key, element }) => {
            const safe_key = key.replace(/\s+/g, '_');
            if (Object.keys(element)[0] === 'range') {

                const min = document.querySelector(`#min_${safe_key}`);
                const max = document.querySelector(`#max_${safe_key}`);
                const min_text = document.querySelector(`#slider_min_${safe_key}`);
                const max_text = document.querySelector(`#slider_max_${safe_key}`);

                if (min && max && min_text && max_text) {
                    [min, max].forEach(input => {
                        input.addEventListener('input', () => {
                            if (parseInt(min.value) > parseInt(max.value)) {
                                min.value = max.value;
                            }
                            if (parseInt(max.value) < parseInt(min.value)) {
                                max.value = min.value;
                            }
                            min_text.innerText = `min: ${min.value}`;
                            max_text.innerText = `max: ${max.value}`;
                        });
                    });
                }
            }
        });
    };

    setup_range_listeners();

    return new Promise((resolve, reject) => {

        const submit_btn = content.querySelector("#custom_menu_submit");
        
        if (submit_btn) {
            submit_btn.addEventListener("click", () => {
                const result = {};
                elements.forEach(({ key, element }) => {
                    const safe_key = key.replace(/\s+/g, '_');
                    const type = Object.keys(element)[0];
                    
                    if (type === 'range') {
                        const min = document.querySelector(`#min_${safe_key}`);
                        const max = document.querySelector(`#max_${safe_key}`);
                        if (min && max) {
                            result[key] = {
                                min: min.value,
                                max: max.value
                            };
                        }
                    } else if (type === 'checkbox') {
                        const checkbox = document.querySelector(`#${safe_key}`);
                        if (checkbox) {
                            result[key] = checkbox.checked;
                        }
                    } else {
                        const el = document.querySelector(`#${safe_key}`);
                        if (el) {
                            result[key] = el.value || el.textContent;
                        }
                    }
                });
                container.removeChild(content);
                resolve(result);
            });
        }

        content.addEventListener("click", (e) => {
            if (e.target === content) {
                container.removeChild(content);
                reject(null);
            }
        });
    });
};

export const message_types = MESSAGE_TYPES;