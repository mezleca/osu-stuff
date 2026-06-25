import type { Action } from "svelte/action";
import { INPUT_BLOCK_GLOBAL_SHORTCUTS } from "../store/input";

export const block_global_shortcuts: Action<HTMLElement> = (node) => {
    // marks controls that own their keyboard events, such as text fields and sliders.
    node.setAttribute(INPUT_BLOCK_GLOBAL_SHORTCUTS, "");

    return {
        destroy() {
            node.removeAttribute(INPUT_BLOCK_GLOBAL_SHORTCUTS);
        }
    };
};
