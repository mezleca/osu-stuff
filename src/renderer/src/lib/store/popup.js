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
    data: []
};

export class PopupAddon {
    constructor() {
        this.elements = [];
        this.callback = null;
        this.element_stores = new Map();
    }

    add(options = {}) {
        const merged_options = { ...DEFAULT_OPTIONS, ...options };

        // validation
        if (
            !merged_options.text &&
            merged_options.type != "container" &&
            merged_options.type != "buttons" &&
            merged_options.type != "dropdown" &&
            merged_options.type != "checkbox"
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

    clear_values() {
        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];
            const store = this.element_stores.get(element.id);

            // peak
            store.set(Array.isArray(get(store)) ? [] : "");
        }
    }

    get_values() {
        const values = {};

        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];
            const store = this.element_stores.get(element.id);

            if (store) {
                const result = get(store);
                values[element.id] = result;
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
            } else {
                console.log("poppu not found", key);
            }
        })();
    }

    hide_popup() {
        const data = get(this.active_popup);
        if (data?.popup) {
            console.log("cleaning values");
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
