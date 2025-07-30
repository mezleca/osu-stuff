import { get, writable } from "svelte/store";

const DEFAULT_OPTIONS = {
    id: "",
    type: "",
    class: "",
    style: "",
    parent: "",
    text: "",
    label: "",
    value: "",
    font_size: 0,
    data: [],
    multiple: false,
    active: null
};

export class PopupAddon {
    constructor() {
        this.elements = [];
        this.callback = null;
        this.element_stores = new Map();
        this.default_values = new Map();
    }

    add(options = {}) {
        const merged_options = { ...DEFAULT_OPTIONS, ...options };

        // text validation
        if (
            !merged_options.text &&
            merged_options.type != "container" &&
            merged_options.type != "buttons" &&
            merged_options.type != "dropdown" &&
            merged_options.type != "checkbox" &&
            merged_options.type != "input"
        ) {
            console.log(`missing text for ${merged_options.type}`);
            return;
        }

        // more validation
        if (!merged_options.type) {
            console.log("misssing type");
            return;
        }

        // even more validation
        if (merged_options.type == "input" && !merged_options.label) {
            console.log("input requires label");
            return;
        }

        this.elements.push(merged_options);
        this.element_stores.set(merged_options.id, writable(merged_options.value));
        this.default_values.set(merged_options.id, merged_options.value);
    }

    remove(element_id) {
        const index = this.elements.findIndex((el) => el.id == element_id);
        if (index != -1) {
            this.elements.splice(index, 1);
            this.element_stores.delete(element_id);
        }
    }

    set_callback(callback) {
        this.callback = callback;
    }

    is_element_active(element) {
        if (!element.active || typeof element.active != "function") {
            return true;
        }

        const condition = element.active();
        const target_store = this.element_stores.get(condition.id);
        const target_value = get(target_store);

        if (condition.except != undefined) {
            if (!target_value && condition.except) {
                return true;
            }
            return target_value != condition.except;
        }

        if (condition.value != undefined) {
            return target_value == condition.value;
        }

        return true;
    }

    reset_inactive_elements() {
        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];
            if (!this.is_element_active(element)) {
                const store = this.element_stores.get(element.id);
                const default_value = this.default_values.get(element.id);
                if (store) {
                    store.set(default_value);
                }
            }
        }
    }

    clear_values() {
        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];
            const store = this.element_stores.get(element.id);

            // restore default value
            const value = this.default_values.get(element.id);
            store.set(value);
        }
    }

    get_values() {
        const values = {};

        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];

            // check if element is active
            if (!this.is_element_active(element)) {
                continue;
            }

            // ignore elements without value (eg. containers)
            if (element.type == "container" || element.type == "text") {
                continue;
            }

            // check if the element is inside a active element
            const parent_container = this.elements.find((el) => el.id == element.parent && el.type == "container");

            // have a parent active container and is nto active?, skip
            if (parent_container && !this.is_element_active(parent_container)) {
                continue;
            }

            const store = this.element_stores.get(element.id);

            if (store) {
                const result = get(store);
                // just return the value instead of a 1 item array
                if (Array.isArray(result) && !element.multiple) {
                    values[element.id] = result[0];
                } else {
                    values[element.id] = result;
                }
            }
        }

        // clean store values
        this.clear_values();

        return values;
    }
}

class PopupManager {
    constructor() {
        this.popups = writable(new Map());
        this.active_popup = writable(null);
    }

    add_popup(key, addon) {
        this.popups.update((popups) => {
            popups.set(key, addon);
            return popups;
        });
    }

    show_popup(key) {
        this.popups.subscribe((popups) => {
            const popup = popups.get(key);
            if (popup) {
                this.active_popup.set({ key, popup });
            }
        })();
    }

    hide_popup() {
        const data = get(this.active_popup);
        if (data?.popup) {
            data.popup.clear_values();
        }
        this.active_popup.set(null);
    }

    get_active_popup() {
        return this.active_popup;
    }
}

const managers = new Map();

/** @returns {PopupManager()}  */
export const get_popup_manager = (key) => {
    if (!managers.has(key)) {
        managers.set(key, new PopupManager());
    }
    return managers.get(key);
};

export const add_new_popup = (key, addon, manager_key = "default") => {
    const manager = get_popup_manager(manager_key);
    manager.add_popup(key, addon);
};

export const show_popup = (key, manager_key = "default") => {
    const manager = get_popup_manager(manager_key);
    manager.show_popup(key);
};

export const hide_popup = (manager_key = "default") => {
    const manager = get_popup_manager(manager_key);
    manager.hide_popup();
};
