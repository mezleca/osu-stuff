<script lang="ts">
    import { onMount, tick } from "svelte";
    import { fade } from "svelte/transition";
    import { context_menu_manager, type ActiveContextMenu } from "../../lib/store/context-menu";
    import MenuItem from "./menu-item.svelte";
    import type { ContextMenuOption } from "@shared/types";

    let active_context: ActiveContextMenu | null = null;
    let menu_element: HTMLDivElement;
    let active_path: ContextMenuOption[] = [];
    let leave_timeout: any;

    const PADDING = 10;

    // subscribe to store
    context_menu_manager.active.subscribe(async (value) => {
        active_context = value;

        if (active_context) {
            active_path = [];
            await tick();
            adjust_position();
        }
    });

    const hide = () => {
        context_menu_manager.hide();
    };

    const adjust_position = () => {
        if (!menu_element || !active_context) {
            return;
        }

        const menu_rect = menu_element.getBoundingClientRect();
        const viewport_width = window.innerWidth;
        const viewport_height = window.innerHeight;

        let adjusted_x = active_context.position.x;
        let adjusted_y = active_context.position.y;

        // prevent overflow on right edge
        if (adjusted_x + menu_rect.width > viewport_width - PADDING) {
            adjusted_x = viewport_width - menu_rect.width - PADDING;
        }

        // prevent overflow on left edge
        if (adjusted_x < PADDING) {
            adjusted_x = PADDING;
        }

        // prevent overflow on bottom edge
        if (adjusted_y + menu_rect.height > viewport_height - PADDING) {
            // try to position above if it overflows bottom
            const new_y = adjusted_y - menu_rect.height;
            if (new_y > PADDING) {
                adjusted_y = new_y;
            } else {
                adjusted_y = viewport_height - menu_rect.height - PADDING;
            }
        }

        // prevent overflow on top edge
        if (adjusted_y < PADDING) {
            adjusted_y = PADDING;
        }

        menu_element.style.left = `${adjusted_x}px`;
        menu_element.style.top = `${adjusted_y}px`;
    };

    const handle_item_click = (item: ContextMenuOption, event: MouseEvent) => {
        event.stopPropagation();

        // dont close if has submenu
        if (item.data && Array.isArray(item.data)) {
            return;
        }

        if (active_context) {
            active_context.on_click(item);
        }

        hide();
    };

    const handle_submenu_enter = (item: ContextMenuOption, depth: number) => {
        clearTimeout(leave_timeout);
        active_path = [...active_path.slice(0, depth), item];
    };

    const handle_submenu_leave = (depth: number) => {
        clearTimeout(leave_timeout);
        leave_timeout = setTimeout(() => {
            active_path = active_path.slice(0, depth);
        }, 150);
    };

    const handle_menu_enter = () => {
        clearTimeout(leave_timeout);
    };

    const handle_menu_leave = () => {
        clearTimeout(leave_timeout);
        leave_timeout = setTimeout(() => {
            hide();
        }, 500);
    };

    const handle_outside_click = (event: MouseEvent) => {
        if (active_context && menu_element && !menu_element.contains(event.target as Node)) {
            hide();
        }
    };

    const handle_keydown = (event: KeyboardEvent) => {
        if (event.key == "Escape") {
            hide();
        }
    };

    onMount(() => {
        document.addEventListener("click", handle_outside_click);
        document.addEventListener("keydown", handle_keydown);

        return () => {
            document.removeEventListener("click", handle_outside_click);
            document.removeEventListener("keydown", handle_keydown);
            clearTimeout(leave_timeout);
        };
    });
</script>

{#if active_context}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={menu_element}
        class="context-menu"
        onmouseenter={handle_menu_enter}
        onmouseleave={handle_menu_leave}
        transition:fade={{ delay: 0, duration: 100 }}
    >
        {#each active_context.options as item}
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
