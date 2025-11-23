import type {
    PopupElement,
    PopupDefinition,
    TextElement,
    InputElement,
    CheckboxElement,
    DropdownElement,
    FileDialogElement,
    ButtonElement,
    ButtonsElement,
    RangeElement,
    ContainerElement,
    PopupData
} from "./types";

export class PopupBuilder {
    private elements: Map<string, PopupElement>;
    private defaults: Map<string, any>;
    private custom_action: boolean;
    private custom_submit: string;
    private custom_cancel: string;
    private hide_actions: boolean;
    private callback: ((value: any) => void) | null;
    private cancel_callback: (() => void) | null;

    constructor() {
        this.elements = new Map();
        this.defaults = new Map();
        this.custom_action = false;
        this.custom_submit = "yes";
        this.custom_cancel = "no";
        this.hide_actions = false;
        this.callback = null;
        this.cancel_callback = null;
    }

    private add_element(element: PopupElement): this {
        this.elements.set(element.id, element);

        // set default value if present
        if ("value" in element) {
            this.defaults.set(element.id, element.value);
        }

        return this;
    }

    add_text(text: string, options: Partial<TextElement> = {}): this {
        return this.add_element({
            id: options.id || crypto.randomUUID(),
            type: "text",
            text,
            ...options
        });
    }

    add_input(id: string, label: string, options: Partial<InputElement> = {}): this {
        return this.add_element({
            id,
            type: "input",
            label,
            value: "",
            ...options
        });
    }

    add_checkbox(id: string, label: string, value: boolean = false, options: Partial<CheckboxElement> = {}): this {
        return this.add_element({
            id,
            type: "checkbox",
            label,
            value,
            ...options
        });
    }

    add_dropdown(id: string, label: string, data: PopupData[], options: Partial<DropdownElement> = {}): this {
        return this.add_element({
            id,
            type: "dropdown",
            label,
            data,
            value: options.value ?? "",
            ...options
        } as DropdownElement);
    }

    add_file_dialog(id: string, label: string, options: Partial<FileDialogElement> = {}): this {
        return this.add_element({
            id,
            type: "file-dialog",
            label,
            value: "",
            dialog_type: "file",
            ...options
        });
    }

    add_button(id: string, text: string, options: Partial<ButtonElement> = {}): this {
        return this.add_element({
            id,
            type: "button",
            text,
            ...options
        });
    }

    add_buttons(id: string, label: string, data: PopupData[], options: Partial<ButtonsElement> = {}): this {
        return this.add_element({
            id,
            type: "buttons",
            label,
            data,
            value: [],
            multiple: false,
            ...options
        } as ButtonsElement);
    }

    add_range(id: string, label: string, min: number, max: number, options: Partial<RangeElement> = {}): this {
        return this.add_element({
            id,
            type: "range",
            label,
            min,
            max,
            value: [min, max],
            ...options
        });
    }

    add_container(id: string, options: Partial<ContainerElement> = {}): this {
        return this.add_element({
            id,
            type: "container",
            ...options
        });
    }

    set_callback(callback: (value: any) => void): this {
        this.callback = callback;
        return this;
    }

    set_cancel_callback(callback: () => void): this {
        this.cancel_callback = callback;
        return this;
    }

    set_custom_actions(submit: string, cancel: string): this {
        this.custom_action = true;
        this.custom_submit = submit;
        this.custom_cancel = cancel;
        return this;
    }

    set_hide_actions(hide: boolean = true): this {
        this.hide_actions = hide;
        return this;
    }

    build(): PopupDefinition {
        return {
            elements: this.elements,
            defaults: this.defaults,
            custom_action: this.custom_action,
            custom_submit: this.custom_submit,
            custom_cancel: this.custom_cancel,
            hide_actions: this.hide_actions,
            callback: this.callback,
            cancel_callback: this.cancel_callback
        };
    }
}
