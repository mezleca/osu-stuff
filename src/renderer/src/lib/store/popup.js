import { get, writable } from "svelte/store";

/**
 * @typedef {Object} ActivePopup
 * @property {string} key
 * @property {BaseAddon} popup
 */

/**
 * @typedef {Object} PopupCondition
 * @property {string} id
 * @property {any} value
 * @property {any} except
 * @property {any} not_equals
 */

/**
 * @typedef {Object} PopupElement
 * @property {string} id
 * @property {string} type
 * @property {string?} class
 * @property {string?} parent
 * @property {string?} text
 * @property {string?} label
 * @property {any} value
 * @property {number?} font_size
 * @property {(Array<PopupElement>|null)} data
 * @property {boolean} multiple
 * @property {PopupCondition} show_when
 */

const DEFAULT_OPTIONS = {
    id: "",
    type: "",
    class: "",
    parent: "",
    text: "",
    label: "",
    value: "",
    font_size: 14,
    data: [],
    multiple: false,
    show_when: null
};

class BaseAddon {
    constructor() {
        /** @type {import("svelte/store").Writable<Map<string, PopupElement>>} */
        this.elements = writable(new Map());
        this.defaults = new Map();
        this.callback = null;
    }

    add(options = {}) {
        throw new Error("add(): not implemented");
    }

    set_callback(callback) {
        this.callback = callback;
    }

    should_show_element(element) {
        const store = get(this.elements);

        if (!element.show_when) {
            return true;
        }

        const { id, equals, not_equals, except } = element.show_when;
        const target = store.get(id);

        if (!target) {
            console.log("[popup] failed to get target store");
            return true;
        }

        if (equals != undefined) {
            return target.value == equals;
        }

        if (not_equals != undefined) {
            return target.value != not_equals;
        }

        if (except != undefined) {
            return target.value != except;
        }

        return !!target.value; // show if true
    }

    /** @returns {(PopupElement|null)} */
    get_element(id) {
        const store = get(this.elements);
        return store ? store.get(id) : null;
    }

    get_elements() {
        const store = get(this.elements);
        return Array.from(store.values());
    }

    update(id, value) {
        // allow either setting a full element object or updating only the
        // element's `value` property. This prevents callers that pass only
        // the new value from overwriting the whole element object.
        this.elements.update((old) => {
            const updated = old ? new Map(old) : new Map();

            const is_full_element = value && typeof value === "object" && (value.type || value.id || value.hasOwnProperty("value"));

            if (is_full_element) {
                // set/replace full element object
                updated.set(id, value);
            } else {
                // update only the value property of an existing element
                const existing = updated.get(id) || { ...DEFAULT_OPTIONS, id };
                updated.set(id, { ...existing, value });
            }

            return updated;
        });

        // Reset hidden elements after the change. This method updates the
        // store directly to avoid calling `update()` again and causing a
        // recursive loop.
        this.reset_hidden_elements();
    }

    reset_hidden_elements() {
        if (this.defaults.size == 0) {
            return;
        }

        // Update the store in a single transaction to avoid triggering
        // `update()` recursively (which would call this method again).
        this.elements.update((old) => {
            const updated = old ? new Map(old) : new Map();

            // iterate over a snapshot of entries
            for (const [id, element] of Array.from(updated.entries())) {
                const default_value = this.defaults.get(id);
                if (default_value === undefined) continue;

                // if the element is currently hidden, reset its value to
                // the stored default
                if (!this.should_show_element(element)) {
                    updated.set(id, { ...element, value: default_value });
                }
            }

            return updated;
        });
    }

    get_values() {
        const values = {};
        const elements = get(this.elements);

        for (const [k, e] of elements) {
            // ignore hidden elements
            if (!this.should_show_element(e)) {
                continue;
            }

            // ignore read only elements
            if (["container", "text"].includes(e.type)) {
                continue;
            }

            values[k] = e.value;
        }

        return values;
    }

    clear() {
        throw new Error("clear(): not implemented");
    }
}

export class ConfirmAddon extends BaseAddon {
    constructor(type) {
        super();
        this.type = type || "text";
    }

    add(options = {}) {
        const element = { ...DEFAULT_OPTIONS, ...options };

        if (!element.id && this.type != "text") {
            console.error("element requires id", element);
            return this;
        }

        // ensure the new element has the correct type/multiple flags
        element.type = this.type == "button" ? "button" : "text";

        if (this.type == "button") {
            element.multiple = false;
        }

        // removed unused properties
        if (element.show_when) {
            delete element.show_when;
        }

        this.update(element.id, element);
        return this;
    }

    // confirmation doesn't need this method
    clear() {}
}

export class PopupAddon extends BaseAddon {
    constructor() {
        super();
    }

    add(options = {}) {
        const element = { ...DEFAULT_OPTIONS, ...options };

        if (!element.id || !element.type) {
            console.error("element requires id and type", element);
            return this;
        }

        // ensure valid properties
        if (element.type == "buttons") {
            if (!element.value) element.value = [];
        } else {
            if (!element.value) element.value = "";
        }

        this.update(element.id, element);
        this.defaults.set(element.id, element.value);
    }

    clear() {
        this.elements.update((old) => {
            const updated = old ? new Map(old) : new Map();

            for (const [id, element] of Array.from(updated.entries())) {
                const default_value = this.defaults.get(id);
                if (default_value === undefined) continue;
                updated.set(id, { ...element, value: default_value });
            }

            return updated;
        });
    }
}

class PopupManager {
    constructor() {
        /** @type {Map<string, BaseAddon>} */
        this.popups = new Map();
        /** @type {import("svelte/store").Writable<ActivePopup|null>} */
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

export const hide_popup = (manager_key = "default") => {
    const manager = get_popup_manager(manager_key);
    manager.hide();
};
