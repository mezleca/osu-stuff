export type PopupElementType = "text" | "input" | "checkbox" | "dropdown" | "file-dialog" | "button" | "buttons" | "range" | "container";

export interface PopupCondition {
    id: string;
    equals?: any;
    not_equals?: any;
    except?: any;
}

export interface BasePopupElement<T extends PopupElementType> {
    id: string;
    type: T;
    class?: string;
    parent?: string;
    show_when?: PopupCondition | PopupCondition[];
}

export interface TextElement extends BasePopupElement<"text"> {
    text: string;
    value?: string;
    font_size?: number;
}

export interface InputElement extends BasePopupElement<"input"> {
    label?: string;
    text?: string; // placeholder
    value?: string;
}

export interface CheckboxElement extends BasePopupElement<"checkbox"> {
    label?: string;
    text?: string;
    value?: boolean;
}

export interface DropdownElement extends BasePopupElement<"dropdown"> {
    label?: string;
    text?: string; // placeholder
    value?: string;
    data: { label: string; value: any }[] | (() => { label: string; value: any }[]);
}

export interface FileDialogElement extends BasePopupElement<"file-dialog"> {
    label?: string;
    value?: string;
    dialog_type?: "file" | "folder";
}

export interface ButtonElement extends BasePopupElement<"button"> {
    text: string;
    label?: string;
    value?: string;
}

export interface ButtonsElement extends BasePopupElement<"buttons"> {
    label?: string;
    value?: string[];
    data: { label: string; value: any }[] | (() => { label: string; value: any }[]);
    multiple?: boolean;
    style?: string;
}

export interface RangeElement extends BasePopupElement<"range"> {
    label?: string;
    value?: [number, number]; // min, max
    min: number;
    max: number;
}

export interface ContainerElement extends BasePopupElement<"container"> {
    text?: string;
    label?: string;
    value?: any;
    style?: string;
}

export type PopupData = { label: string; value: any } | (() => { label: string; value: any });

export type PopupElement =
    | TextElement
    | InputElement
    | CheckboxElement
    | DropdownElement
    | FileDialogElement
    | ButtonElement
    | ButtonsElement
    | RangeElement
    | ContainerElement;

export interface PopupDefinition {
    elements: Map<string, PopupElement>;
    defaults: Map<string, any>;
    custom_action: boolean;
    custom_submit: string;
    custom_cancel: string;
    hide_actions: boolean;
    callback: ((value: any) => void) | null;
    cancel_callback: (() => void) | null;
}
