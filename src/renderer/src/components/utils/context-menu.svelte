<script>
    import { onMount, onDestroy, tick } from "svelte";
    import { mouse_position } from "../../lib/utils/utils";

    export let options = [];
    export let onclick = () => {};
    export let at = "point";

    $: is_visible = false;

    let menu_element;
    let position = { x: 0, y: 0 };
    let active_submenu = null;
    let hover_timeout;
    let current_target = null;
    let resolved_options = [];

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
        await tick();
        adjust_position();
    };

    export const hide = () => {
        is_visible = false;
        active_submenu = null;
        clearTimeout(hover_timeout);
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

        // only update position if it actually changed
        if (position.x != adjusted_x || position.y != adjusted_y) {
            position = { x: adjusted_x, y: adjusted_y };
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

    const handle_item_hover = (item) => {
        clearTimeout(hover_timeout);

        if (item.data && Array.isArray(item.data)) {
            hover_timeout = setTimeout(() => {
                active_submenu = item.id;
            }, 100);
        } else {
            active_submenu = null;
        }
    };

    const handle_item_leave = () => {
        clearTimeout(hover_timeout);
        hover_timeout = setTimeout(() => {
            active_submenu = null;
        }, 150);
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

        return () => {
            document.removeEventListener("click", handle_outside_click);
            document.removeEventListener("keydown", handle_keydown);
        };
    });

    onDestroy(() => {
        clearTimeout(hover_timeout);
    });
</script>

{#if $$slots.default}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div oncontextmenu={handle_context_menu}>
        <slot />
    </div>
{/if}

<!-- context menu -->
{#if is_visible}
    <div bind:this={menu_element} class="context-menu" style="left: {position.x}px; top: {position.y}px;">
        {#each resolved_options as item}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="menu-item"
                class:has-submenu={item.data && Array.isArray(item.data)}
                onclick={(e) => handle_item_click(item, e)}
                onmouseenter={() => handle_item_hover(item)}
                onmouseleave={handle_item_leave}
            >
                <span>{item.text}</span>
                {#if item.data && Array.isArray(item.data)}
                    <span class="arrow">▶</span>
                {/if}

                <!-- submenu -->
                {#if item.data && Array.isArray(item.data) && active_submenu == item.id}
                    <div class="submenu">
                        {#each item.data as sub_item}
                            <div class="menu-item" onclick={(e) => handle_item_click(sub_item, e)}>
                                {sub_item.text}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
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
        z-index: 9999;
        min-width: 120px;
        font-size: 0.8em;
        transform: translateZ(0);
    }

    .menu-item {
        position: relative;
        padding: 8px 12px;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: background-color 0.1s ease;
    }

    .menu-item:hover {
        background-color: var(--bg-secondary);
    }

    .menu-item.has-submenu {
        padding-right: 24px;
    }

    .arrow {
        position: absolute;
        right: 8px;
        font-size: 8px;
        color: #666;
    }

    .submenu {
        position: absolute;
        left: calc(100% + 2px);
        top: -4px;
        background: var(--bg-primary);
        border: 1px solid #2e2e2e;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-radius: 6px;
        padding: 4px 0;
        min-width: 150px;
        z-index: 10000;
    }
</style>
