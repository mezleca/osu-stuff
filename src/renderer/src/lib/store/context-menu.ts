import { writable, type Writable } from "svelte/store";
import type { ContextMenuOption } from "@shared/types";

export interface ActiveContextMenu {
    options: ContextMenuOption[];
    position: { x: number; y: number };
    on_click: (item: ContextMenuOption) => void;
}

class ContextMenuManager {
    active: Writable<ActiveContextMenu | null>;

    constructor() {
        this.active = writable(null);
    }

    show(event: MouseEvent, options: ContextMenuOption[], on_click: (item: ContextMenuOption) => void): void {
        event.preventDefault();
        event.stopPropagation();

        this.active.set({
            options,
            position: { x: event.clientX, y: event.clientY },
            on_click
        });
    }

    hide(): void {
        this.active.set(null);
    }
}

export const context_menu_manager = new ContextMenuManager();

export const show_context_menu = (event: MouseEvent, options: ContextMenuOption[], on_click: (item: ContextMenuOption) => void) => {
    context_menu_manager.show(event, options, on_click);
};

export const hide_context_menu = () => {
    context_menu_manager.hide();
};
