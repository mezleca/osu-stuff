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
 * @property {(PopupCondition|Array<PopupCondition>)} show_when
 */

const DEFAULT_OPTIONS = {
    id: "",
    type: "",
    class: "", // css
    parent: "", // parent container
    text: "",
    label: "", // for buttons, etc...
    value: "",
    font_size: 14, // for text type
    min: 0, // range type
    max: 10, // range type
    data: [], // for buttons
    multiple: false, // for buttons
    show_when: null // condition array
};

class BaseAddon {
    constructor() {
        /** @type {import("svelte/store").Writable<Map<string, PopupElement>>} */
        this.elements = writable(new Map());
        this.custom_action = false;
        this.custom_submit = "yes";
        this.custom_cancel = "no";
        this.defaults = new Map();
        this.callback = null;
        this.cancel_callback = null;
    }

    add(options = {}) {
        throw new Error("add(): not implemented");
    }

    set_callback(callback) {
        this.callback = callback;
    }

    set_cancel_callback(callback) {
        this.cancel_callback = callback;
    }

    evaluate_condition(condition) {
        const store = get(this.elements);
        const { id, equals, not_equals, except } = condition;
        const target = store.get(id);

        if (!target) {
            console.log("[popup] failed to get target store for condition:", id);
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

    should_show_element(element) {
        if (!element.show_when) {
            return true;
        }

        // support multiple conditions
        const conditions = Array.isArray(element.show_when) ? element.show_when : [element.show_when];
        return conditions.every((condition) => this.evaluate_condition(condition));
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
        this.elements.update((old) => {
            const updated = old ? new Map(old) : new Map();
            const is_full_element = value && typeof value == "object" && (value.type || value.id || value.hasOwnProperty("value"));

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

        // reset hidden elements after the change
        this.reset_hidden_elements();
    }

    reset_hidden_elements() {
        if (this.defaults.size == 0) {
            return;
        }

        this.elements.update((old) => {
            const updated = old ? new Map(old) : new Map();

            for (const [id, element] of Array.from(updated.entries())) {
                const default_value = this.defaults.get(id);

                if (!default_value) {
                    continue;
                }

                // if the element is currently hidden, reset its value to the stored default
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

    set_submit_action(value) {
        this.custom_action = true;
        this.custom_submit = value;
    }

    set_cancel_action(value) {
        this.custom_action = true;
        this.custom_cancel = value;
    }

    clear() {
        throw new Error("clear(): not implemented");
    }
}

export class ConfirmAddon extends BaseAddon {
    constructor() {
        super();
    }

    add(options = {}) {
        const element = { ...DEFAULT_OPTIONS, ...options };

        // if no type is specified, determine by properties
        if (!element.type) {
            if (element.id && (element.text || element.label)) {
                element.type = "button";
            } else if (element.text && !element.id) {
                element.type = "text";
            } else {
                console.error("element requires either id+text/label for button or just text for display", element);
                return this;
            }
        }

        // validate based on type
        if (element.type == "button") {
            if (!element.id) {
                console.error("button element requires id", element);
                return this;
            }

            if (!element.text && !element.label) {
                console.error("button element requires text or label", element);
                return this;
            }

            element.multiple = false;
        } else if (element.type == "text") {
            // text doesn't need id, but if missing, generate random one
            if (!element.id) {
                element.id = crypto.randomUUID();
            }

            if (!element.text) {
                console.error("text element requires text property", element);
                return this;
            }
        } else {
            console.error("ConfirmAddon only supports 'button' and 'text' types, got:", element.type);
            return this;
        }

        // remove usless properties in confirm
        delete element.show_when;
        delete element.data;

        this.update(element.id, element);
        return this;
    }

    add_title(text, options = {}) {
        return this.add({
            type: "text",
            text,
            class: options.class || "title",
            font_size: options.font_size || 16,
            ...options
        });
    }

    add_button(id, text, options = {}) {
        return this.add({
            type: "button",
            id,
            text,
            ...options
        });
    }

    // clear is not needed on this class
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

        // ensure valid properties per type
        if (element.type == "buttons") {
            if (!element.value) element.value = [];
        } else if (element.type == "range") {
            if (!element.value || typeof element.value != "object") {
                element.value = { min: element.min, max: element.max };
            } else {
                element.value = {
                    min: Math.max(element.min, parseFloat(element.value.min ?? element.min)),
                    max: Math.min(element.max, parseFloat(element.value.max ?? element.max))
                };
            }
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
                if (default_value == undefined) continue;
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

export const quick_confirm = async (title, options = {}) => {
    const addon = new ConfirmAddon();

    addon.add_title(title);

    if (!options?.submit) options.submit = "yes";
    if (!options?.cancel) options.cancel = "no";

    // add custom actions
    addon.set_submit_action(options.submit);
    addon.set_cancel_action(options.cancel);

    // get/create temp manager
    const manager_key = options?.key ? options.key : "temp";
    const manager = get_popup_manager(manager_key);

    // wait until the user does something
    const result = await new Promise((resolve) => {
        // finish promise on action
        addon.set_callback((value) => resolve(value));
        addon.set_cancel_callback(() => resolve(null));

        // temp register the new addon
        manager.register("confirmation", addon);

        // show it
        manager.show("confirmation");
    });

    return result;
};
