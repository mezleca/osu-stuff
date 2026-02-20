<script lang="ts">
    import { tick } from "svelte";
    import { fade, scale } from "svelte/transition";
    import { clamp } from "../../lib/utils/utils";
    import type { ContextMenuOption } from "@shared/types";

    export let item: ContextMenuOption;
    export let depth: number;
    export let active_path;
    export let onclick;
    export let on_submenu_enter;
    export let on_submenu_leave;

    let item_element: HTMLDivElement;
    let submenu_element: HTMLDivElement;
    let submenu_style = "";

    const VIEWPORT_PADDING = 10;
    const SUBMENU_GAP = 2;
    const SUBMENU_Y_OFFSET = 4;

    $: has_submenu = item?.data && Array.isArray(item.data);
    $: is_item_active = active_path[depth] && active_path[depth].id == item.id;

    $: if (has_submenu && is_item_active) {
        tick().then(adjust_submenu_position);
    }

    const adjust_submenu_position = () => {
        if (!submenu_element || !item_element) {
            return;
        }

        const anchor_rect = item_element.getBoundingClientRect();
        const submenu_width = submenu_element.offsetWidth || 150;
        const submenu_height = submenu_element.offsetHeight || 240;

        let x = anchor_rect.right + SUBMENU_GAP;
        let y = anchor_rect.top - SUBMENU_Y_OFFSET;

        if (x + submenu_width > window.innerWidth - VIEWPORT_PADDING) {
            x = anchor_rect.left - submenu_width - SUBMENU_GAP;
        }

        if (y + submenu_height > window.innerHeight - VIEWPORT_PADDING) {
            y = window.innerHeight - submenu_height - VIEWPORT_PADDING;
        }

        x = clamp(x, VIEWPORT_PADDING, window.innerWidth - submenu_width - VIEWPORT_PADDING);
        y = clamp(y, VIEWPORT_PADDING, window.innerHeight - submenu_height - VIEWPORT_PADDING);

        submenu_style = `left:${Math.round(x)}px;top:${Math.round(y)}px;`;
    };

    const handle_click = (e: MouseEvent) => {
        e.stopPropagation();
        if (!item.data) {
            onclick(item, e);
        }
    };

    const handle_mouse_enter = () => {
        if (has_submenu) {
            on_submenu_enter(item, depth);
        } else {
            on_submenu_leave(depth);
        }
    };

    const handle_mouse_leave = () => {
        if (has_submenu) {
            on_submenu_leave(depth);
        }
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu-item-container">
    <div
        bind:this={item_element}
        class="menu-item"
        class:has-submenu={has_submenu}
        onmouseenter={handle_mouse_enter}
        onmouseleave={handle_mouse_leave}
        onclick={handle_click}
    >
        <span>{item?.text}</span>
        {#if has_submenu}
            <span class="arrow">▶</span>
        {/if}
    </div>

    {#if has_submenu && is_item_active}
        <div
            bind:this={submenu_element}
            class="submenu"
            style={submenu_style}
            onmouseenter={() => on_submenu_enter(item, depth)}
            in:scale={{ duration: 100, start: 0.96 }}
            out:fade={{ duration: 80 }}
        >
            <div class="submenu-list">
                {#each item.data as sub_item}
                    <svelte:self item={sub_item} depth={depth + 1} {active_path} {onclick} {on_submenu_enter} {on_submenu_leave} />
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .menu-item-container {
        position: relative;
    }

    .menu-item {
        padding: 8px 12px;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: "Torus SemiBold";
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
        position: fixed;
        background: var(--bg-primary);
        border: 1px solid #2e2e2e;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-radius: 6px;
        padding: 4px 0;
        min-width: 150px;
        z-index: 99999;
    }

    .submenu-list {
        max-height: min(60vh, 360px);
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
    }
</style>
