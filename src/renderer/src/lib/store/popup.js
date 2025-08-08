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
    font_size: 14,
    data: [],
    multiple: false,
    show_when: null
};

export class PopupAddon {
    constructor() {
        this.elements = [];
        this.callback = null;
        this.stores = new Map();
        this.defaults = new Map();
    }

    add(options = {}) {
        const element = { ...DEFAULT_OPTIONS, ...options };

        if (!element.id || !element.type) {
            console.error("element requires id and type", element);
            return this;
        }

        this.elements.push(element);
        this.stores.set(element.id, writable(element.value));
        this.defaults.set(element.id, element.value);
    }

    set_callback(callback) {
        this.callback = callback;
    }

    should_show_element(element) {
        if (!element.show_when) {
            return true;
        }

        const { id, equals, not_equals, except } = element.show_when;
        const target_store = this.stores.get(id);

        if (!target_store) {
            console.log("[popup] failed to get target store");
            return true;
        }

        const target_value = get(target_store);

        if (equals != undefined) {
            return target_value == equals;
        }

        if (not_equals != undefined) {
            return target_value != not_equals;
        }

        if (except != undefined) {
            return target_value != except;
        }

        return !!target_value; // show if true
    }

    get_store_value(element_id) {
        const store = this.stores.get(element_id);
        return store ? get(store) : null;
    }

    update_store(element_id, value) {
        const store = this.stores.get(element_id);
        if (store) {
            store.set(value);
            this.reset_hidden_elements();
        }
    }

    reset_hidden_elements() {
        this.elements.forEach((element) => {
            if (!this.should_show_element(element)) {
                const default_value = this.defaults.get(element.id);
                this.stores.get(element.id)?.set(default_value);
            }
        });
    }

    get_values() {
        const values = {};

        this.elements
            .filter((el) => this.should_show_element(el))
            .filter((el) => !["container", "text"].includes(el.type))
            .forEach((el) => {
                const value = this.get_store_value(el.id);
                values[el.id] = value;
            });

        return values;
    }

    clear() {
        this.elements.forEach((element) => {
            const default_value = this.defaults.get(element.id);
            this.stores.get(element.id)?.set(default_value);
        });
    }
}

class PopupManager {
    constructor() {
        this.popups = new Map();
        this.active = writable(null);
    }

    register(key, popup_builder) {
        this.popups.set(key, popup_builder);
    }

    show(key) {
        const popup = this.popups.get(key);
        if (popup) {
            this.active.set({ key, popup });
        }
    }

    hide() {
        const current = get(this.active);

        if (current?.popup) {
            current.popup.clear();
        }

        this.active.set(null);
    }

    get_active() {
        return this.active;
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

export const show_popup = (key, manager_key = "default") => {
    const manager = get_popup_manager(manager_key);
    manager.show(key);
};

export const hide_popup = async (manager_key = "default") => {
    const manager = get_popup_manager(manager_key);
    await manager.hide();
};
