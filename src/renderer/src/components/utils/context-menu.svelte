<script>
    import { onMount, tick } from "svelte";
    import { fade } from "svelte/transition";
    import { mouse_position } from "../../lib/utils/utils";

    import MenuItem from "./menu-item.svelte";

    export let options = [];
    export let onclick = () => {};
    export let at = "point";

    let is_visible = false;
    let menu_element;
    let position = { x: 0, y: 0 };
    let current_target = null;
    let resolved_options = [];
    let active_path = [];
    let leave_timeout;
    let last_menu = null;
    let mouse_entered_menu = false;

    export const show = async (target_or_event) => {
        if (typeof options == "function") {
            resolved_options = await options();
        } else {
            resolved_options = options;
        }

        // determine position based on target type
        if (target_or_event instanceof MouseEvent) {
            current_target = target_or_event.target;
        } else if (target_or_event instanceof Element) {
            current_target = target_or_event;
        }

        position = get_position(current_target);
        is_visible = true;
        active_path = [];
        mouse_entered_menu = false;

        await tick();
        adjust_position();

        // auto close if we're not hovering
        setTimeout(() => {
            if (is_visible && !mouse_entered_menu) {
                hide();
            }
        }, 2000);
    };

    export const hide = () => {
        is_visible = false;
        active_path = [];
        mouse_entered_menu = false;
        clearTimeout(leave_timeout);
    };

    const get_position = (element) => {
        const rect = element.getBoundingClientRect();

        if (at == "below") {
            return { x: rect.left, y: rect.bottom };
        } else if (at == "top") {
            return { x: rect.left, y: rect.top - 10 }; // small offset
        } else {
            // defaults to cursor position
            return mouse_position;
        }
    };

    const adjust_position = () => {
        if (!menu_element) {
            return;
        }

        const menu_rect = menu_element.getBoundingClientRect();
        const viewport_width = window.innerWidth;
        const viewport_height = window.innerHeight;
        const PADDING = 10;

        let adjusted_x = position.x;
        let adjusted_y = position.y;

        // adjust horizontal
        if (adjusted_x + menu_rect.width > viewport_width - PADDING) {
            adjusted_x = viewport_width - menu_rect.width - PADDING;
        }

        // ensure menu doesnt go off left edge
        if (adjusted_x < PADDING) {
            adjusted_x = PADDING;
        }

        // adjust vertical
        if (adjusted_y + menu_rect.height > viewport_height - PADDING) {
            if (at == "below" && current_target) {
                // flip to top if showing below
                const rect = current_target.getBoundingClientRect();
                adjusted_y = rect.top - menu_rect.height - 5;
            } else {
                adjusted_y = viewport_height - menu_rect.height - PADDING;
            }
        }

        // ensure menu doesn't go off top edge
        if (adjusted_y < PADDING) {
            adjusted_y = PADDING;
        }
    };

    const handle_item_click = (item, event) => {
        event.stopPropagation();

        // if has submenu, dont close
        if (item.data && Array.isArray(item.data)) {
            return;
        }

        hide();
        onclick({ detail: item });
    };

    const handle_submenu_enter = (item, depth) => {
        clearTimeout(leave_timeout);
        mouse_entered_menu = true;
        active_path = [...active_path.slice(0, depth), item];
        last_menu = item;
    };

    const handle_submenu_leave = (depth) => {
        clearTimeout(leave_timeout);
        leave_timeout = setTimeout(() => {
            active_path = active_path.slice(0, depth);
            last_menu = null;
        }, 150);
    };

    const handle_menu_enter = () => {
        clearTimeout(leave_timeout);
        mouse_entered_menu = true;
    };

    const handle_menu_leave = () => {
        clearTimeout(leave_timeout);
        leave_timeout = setTimeout(() => {
            hide();
        }, 200); // Simpler: just close after leaving
    };

    const handle_outside_click = (event) => {
        if (!menu_element || !menu_element.contains(event.target)) {
            hide();
        }
    };

    const handle_context_menu = async (event) => {
        event.preventDefault();
        await show(event);
    };

    const handle_keydown = (event) => {
        if (event.key == "Escape") {
            hide();
        }
    };

    onMount(() => {
        document.addEventListener("click", handle_outside_click);
        document.addEventListener("keydown", handle_keydown);

        // on destroy
        return () => {
            document.removeEventListener("click", handle_outside_click);
            document.removeEventListener("keydown", handle_keydown);
            clearTimeout(leave_timeout);
        };
    });
</script>

{#if $$slots.default}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div oncontextmenu={handle_context_menu}>
        <slot />
    </div>
{/if}

{#if is_visible}
    <!-- @TODO: apply fade to other items -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={menu_element}
        class="context-menu"
        style="left: {position.x}px; top: {position.y}px;"
        onmouseenter={handle_menu_enter}
        onmouseleave={handle_menu_leave}
        transition:fade={{ delay: 0, duration: 100 }}
    >
        {#each resolved_options as item}
            <MenuItem
                {item}
                {active_path}
                depth={0}
                onclick={handle_item_click}
                on_submenu_enter={handle_submenu_enter}
                on_submenu_leave={handle_submenu_leave}
            />
        {/each}
    </div>
{/if}

<style>
    .context-menu {
        position: fixed;
        background: var(--bg-primary);
        border: 1px solid #2e2e2e;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 4px 0;
        z-index: 99999;
        min-width: 120px;
        font-size: 0.8em;
        transform: translateZ(0);
    }
</style>
