<script lang="ts">
    import { onDestroy, tick } from "svelte";
    import { scale } from "svelte/transition";
    import { clamp } from "../../lib/utils/utils";
    import { debounce } from "@shared/timing";
    import type { ContextMenuOption, MousePoint } from "@shared/types";

    export let item: ContextMenuOption;
    export let depth: number;
    export let active_path: ContextMenuOption[] = [];
    export let onclick: (item: ContextMenuOption, event: MouseEvent) => void;
    export let on_submenu_enter: (item: ContextMenuOption, depth: number) => void;
    export let get_mouse_points: () => MousePoint[] = () => [];

    let item_element: HTMLDivElement;
    let submenu_element: HTMLDivElement;
    let submenu_style = "";

    const VIEWPORT_PADDING = 10;
    const SUBMENU_GAP = 2;
    const SUBMENU_Y_OFFSET = 4;
    const SUBMENU_AIM_DELAY_MS = 220;

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

    const point_in_triangle = (p: MousePoint, a: MousePoint, b: MousePoint, c: MousePoint): boolean => {
        const sign = (p1: MousePoint, p2: MousePoint, p3: MousePoint): number => {
            return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
        };

        const d1 = sign(p, a, b);
        const d2 = sign(p, b, c);
        const d3 = sign(p, c, a);
        const has_negative = d1 < 0 || d2 < 0 || d3 < 0;
        const has_positive = d1 > 0 || d2 > 0 || d3 > 0;

        return !(has_negative && has_positive);
    };

    const should_delay_submenu_enter = (event: MouseEvent): boolean => {
        const points = get_mouse_points();

        if (!Array.isArray(points) || points.length < 2 || !item_element) {
            return false;
        }

        const previous_point = points[points.length - 2] as MousePoint;
        const current_point: MousePoint = { x: event.clientX, y: event.clientY };
        const current_active_submenu = document.querySelector(`.submenu[data-depth="${depth}"]`) as HTMLDivElement | null;

        if (!current_active_submenu || !current_active_submenu.isConnected) {
            return false;
        }

        const submenu_rect = current_active_submenu.getBoundingClientRect();
        const anchor_rect = item_element.getBoundingClientRect();
        const opens_left = submenu_rect.right <= anchor_rect.left;
        const near_top = {
            x: opens_left ? submenu_rect.right : submenu_rect.left,
            y: submenu_rect.top
        };
        const near_bottom = {
            x: opens_left ? submenu_rect.right : submenu_rect.left,
            y: submenu_rect.bottom
        };

        return point_in_triangle(current_point, previous_point, near_top, near_bottom);
    };

    const delayed_submenu_enter = debounce((target_item: ContextMenuOption, target_depth: number) => {
        on_submenu_enter(target_item, target_depth);
    }, SUBMENU_AIM_DELAY_MS);

    const handle_mouse_enter = (event: MouseEvent) => {
        if (has_submenu) {
            if (!is_item_active && should_delay_submenu_enter(event)) {
                delayed_submenu_enter(item, depth);
                return;
            }

            delayed_submenu_enter.cancel();
            on_submenu_enter(item, depth);
        } else {
            delayed_submenu_enter.cancel();
        }
    };

    const handle_mouse_leave = (_event: MouseEvent) => {
        delayed_submenu_enter.cancel();
    };

    onDestroy(() => {
        delayed_submenu_enter.cancel();
    });
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
        <div bind:this={submenu_element} class="submenu" data-depth={depth} style={submenu_style} in:scale={{ duration: 100, start: 0.96 }}>
            <div class="submenu-list">
                {#each item.data as sub_item (sub_item.id)}
                    <svelte:self item={sub_item} depth={depth + 1} {active_path} {onclick} {on_submenu_enter} {get_mouse_points} />
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
