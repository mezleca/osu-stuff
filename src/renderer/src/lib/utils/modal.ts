import { writable } from "svelte/store";

export enum ModalType {
    none = 0,
    get_collection,
    export_collection,
    export_beatmaps,
    merge_collection,
    empty_collection,
    quick_confirm,
    new_mirror,
    missing_beatmaps
}

export const current_modal = writable(ModalType.none);

// quick confirm stuff
export interface IQuickConfirmOptions {
    text: string;
    confirm_text?: string;
    cancel_text?: string;
    on_confirm: () => void;
    on_cancel: () => void;
}

export const quick_confirm_options = writable<IQuickConfirmOptions | null>(null);

export const show_modal = (modal: ModalType) => {
    current_modal.set(modal);
};

export const quick_confirm = (text: string, options?: { submit?: string; cancel?: string }): Promise<boolean> => {
    return new Promise((resolve) => {
        quick_confirm_options.set({
            text,
            confirm_text: options?.submit ?? "yes",
            cancel_text: options?.cancel ?? "no",
            on_confirm: () => {
                resolve(true);
                show_modal(ModalType.none);
            },
            on_cancel: () => {
                resolve(false);
                show_modal(ModalType.none);
            }
        });
        show_modal(ModalType.quick_confirm);
    });
};
