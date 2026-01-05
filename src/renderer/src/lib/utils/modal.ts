import { get, Writable, writable } from "svelte/store";

export enum ModalType {
    get_collection,
    export_collection,
    export_beatmaps,
    merge_collection,
    empty_collection,
    quick_confirm,
    new_mirror,
    missing_beatmaps,
    beatmap_preview
}

class ModalManager {
    active_modals: Writable<Set<ModalType>> = writable(new Set());

    // if we're on a modal, use reactive shit
    subscribe = (run: (value: Set<ModalType>) => void, invalidate?: (value?: Set<ModalType>) => void) => {
        return this.active_modals.subscribe(run, invalidate);
    };

    // otherwise use that :)
    has = (modal: ModalType) => {
        return get(this.active_modals).has(modal);
    };

    show = (modal: ModalType) => {
        this.active_modals.update((modals: Set<ModalType>) => {
            modals.add(modal);
            return modals;
        });
    };

    hide = (modal: ModalType) => {
        this.active_modals.update((modals: Set<ModalType>) => {
            modals.delete(modal);
            return modals;
        });
    };

    size = () => {
        return get(this.active_modals).size;
    };
}

export const modals = new ModalManager();

export interface IQuickConfirmOptions {
    text: string;
    confirm_text?: string;
    cancel_text?: string;
    on_confirm: () => void;
    on_cancel: () => void;
}

export const quick_confirm_options = writable<IQuickConfirmOptions | null>(null);

export const quick_confirm = (text: string, options?: { submit?: string; cancel?: string }): Promise<boolean> => {
    return new Promise((resolve) => {
        quick_confirm_options.set({
            text,
            confirm_text: options?.submit ?? "yes",
            cancel_text: options?.cancel ?? "no",
            on_confirm: () => {
                resolve(true);
                modals.hide(ModalType.quick_confirm);
            },
            on_cancel: () => {
                resolve(false);
                modals.hide(ModalType.quick_confirm);
            }
        });

        modals.show(ModalType.quick_confirm);
    });
};
