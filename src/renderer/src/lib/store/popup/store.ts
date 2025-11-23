import { get, writable, type Writable } from "svelte/store";
import type { PopupDefinition, PopupElement, PopupCondition } from "./types";
import { PopupBuilder } from "./builder";

interface ActivePopup {
    key: string;
    popup: PopupDefinition;
}

interface QuickConfirmOptions {
    submit?: string;
    cancel?: string;
    key?: string;
}

class PopupManager {
    popups: Map<string, PopupDefinition>;
    active: Writable<ActivePopup | null>;

    constructor() {
        this.popups = new Map();
        this.active = writable(null);
    }

    register(key: string, definition: PopupDefinition): void {
        this.popups.set(key, definition);
    }

    show(key: string): void {
        const popup = this.popups.get(key);
        if (popup) {
            this.active.set({ key, popup });
        }
    }

    hide(): void {
        const current = get(this.active);

        if (current?.popup) {
            this.clear_popup(current.popup);
        }

        this.active.set(null);
    }

    get_active(): Writable<ActivePopup | null> {
        return this.active;
    }

    evaluate_condition(condition: PopupCondition, elements: Map<string, PopupElement>): boolean {
        const { id, equals, not_equals, except } = condition;
        const target = elements.get(id);

        if (!target) {
            console.log("[popup] failed to get target store for condition:", id);
            return true;
        }

        // @ts-ignore - value exists on most elements
        const value = target.value;

        if (equals != undefined) {
            return value == equals;
        }

        if (not_equals != undefined) {
            return value != not_equals;
        }

        if (except != undefined) {
            return value != except;
        }

        return !!value;
    }

    should_show_element(element: PopupElement, elements: Map<string, PopupElement>): boolean {
        if (!element.show_when) {
            return true;
        }

        const conditions = Array.isArray(element.show_when) ? element.show_when : [element.show_when];
        return conditions.every((condition) => this.evaluate_condition(condition, elements));
    }

    update_element(popup: PopupDefinition, id: string, value: any): void {
        const element = popup.elements.get(id);
        if (element) {
            // @ts-ignore
            element.value = value;
            popup.elements.set(id, element); // trigger update if needed? svelte store might handle object mutation if we force update

            // force update active store to trigger reactivity
            this.active.update((current) => {
                if (current && current.popup === popup) {
                    return { ...current };
                }
                return current;
            });

            this.reset_hidden_elements(popup);
        }
    }

    reset_hidden_elements(popup: PopupDefinition): void {
        if (popup.defaults.size == 0) return;

        let changed = false;
        for (const [id, element] of popup.elements) {
            const default_value = popup.defaults.get(id);
            if (default_value === undefined) continue;

            if (!this.should_show_element(element, popup.elements)) {
                // @ts-ignore
                if (element.value !== default_value) {
                    // @ts-ignore
                    element.value = default_value;
                    changed = true;
                }
            }
        }

        if (changed) {
            this.active.update((current) => {
                if (current && current.popup === popup) {
                    return { ...current };
                }
                return current;
            });
        }
    }

    get_values(popup: PopupDefinition): Record<string, any> {
        const values: Record<string, any> = {};

        for (const [k, e] of popup.elements) {
            if (!this.should_show_element(e, popup.elements)) continue;
            if (["container", "text", "button"].includes(e.type)) continue;

            // @ts-ignore
            values[k] = e.value;
        }

        return values;
    }

    clear_popup(popup: PopupDefinition): void {
        for (const [id, element] of popup.elements) {
            const default_value = popup.defaults.get(id);
            if (default_value !== undefined) {
                // @ts-ignore
                element.value = default_value;
            }
        }
    }
}

const managers = new Map<string, PopupManager>();

export const get_popup_manager = (key: string): PopupManager => {
    if (!managers.has(key)) {
        managers.set(key, new PopupManager());
    }
    return managers.get(key)!;
};

export const show_popup = (key: string, manager_key: string = "default"): void => {
    const manager = get_popup_manager(manager_key);
    manager.show(key);
};

export const hide_popup = (manager_key: string = "default"): void => {
    const manager = get_popup_manager(manager_key);
    manager.hide();
};

export const quick_confirm = async (title: string, options: QuickConfirmOptions = {}): Promise<any> => {
    const builder = new PopupBuilder();

    builder.add_text(title, { class: "title", font_size: 16 });

    if (!options?.submit) options.submit = "yes";
    if (!options?.cancel) options.cancel = "no";

    builder.set_custom_actions(options.submit, options.cancel);

    const manager_key = options?.key ? options.key : "temp";
    const manager = get_popup_manager(manager_key);

    return new Promise((resolve) => {
        builder.set_callback((value) => resolve(value));
        builder.set_cancel_callback(() => resolve(null));

        manager.register("confirmation", builder.build());
        manager.show("confirmation");
    });
};
