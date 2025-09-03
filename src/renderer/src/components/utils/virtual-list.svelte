<script>
    import { onMount, tick } from "svelte";
    import { debounce } from "../../lib/utils/utils";

    export let count = 0;
    export let item_height = 100;
    export let buffer = 6;
    export let extra = 0; // create extra spacing on end if we have more than 10 items
    export let height = "100%";
    export let carousel = false;
    export let max_width = false;
    export let key = crypto.randomUUID();
    export let direction = "right";
    export let on_update = null;
    export let selected = -1;
    export let columns = null;

    let container;
    let viewport;
    let hovered_item = -1;
    let container_height = 0;
    let animation_frame_id = null;
    let last_scroll_top = -1;
    let last_hovered_item = -1;
    let padding = 10;
    let scroll_timeout = null;
    let is_scrolling = false;

    // cache for element styles to avoid redundant updates
    let element_cache = new Map();

    $: columns_mode = columns && columns > 1;
    $: carousel_enabled = carousel && !columns_mode;
    $: scroll_top = 0;
    $: rows_per_screen = columns_mode ? Math.ceil(count / columns) : count > 10 ? count + extra : count;
    $: item_height_with_padding = item_height + padding;
    $: total_height = rows_per_screen * item_height_with_padding;
    $: start_index = Math.max(0, Math.floor(scroll_top / item_height_with_padding) - buffer);
    $: visible_count = Math.ceil(container_height / item_height_with_padding) + buffer * 2;
    $: end_index = Math.min(start_index + visible_count, rows_per_screen);
    $: visible_items = end_index - start_index;
    $: offset_y = start_index * item_height_with_padding;

    const lerp = (start, end, factor) => start + (end - start) * factor;

    const CAROUSEL_CONFIG = {
        SCALE_THRESHOLD_NEAR: 0.5,
        SCALE_THRESHOLD_FAR: 2.0,
        FADE_RANGE: 1.5,
        SCALE_FULL: 1.0,
        SCALE_MINIMUM: 0.95,
        HOVER_SCALE_MULTIPLIER: 1.01,
        HOVER_SCALE_MAX: 1.03,
        HOVER_MARGIN: 8
    };

    const update_carousel_effect = () => {
        if (!carousel_enabled || !container || is_scrolling) {
            return;
        }

        const scroll_changed = scroll_top != last_scroll_top;
        const hover_changed = hovered_item != last_hovered_item;

        if (!scroll_changed && !hover_changed) {
            return;
        }

        const center_y = scroll_top + container_height / 2;
        const elements = [...container.querySelectorAll(".item")];

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const item_index = start_index + i;

            if (!element || item_index >= count) {
                continue;
            }

            const item_center_y = item_index * item_height_with_padding + item_height_with_padding / 2;
            const distance_from_center = Math.abs(item_center_y - center_y);
            const normalized_distance = distance_from_center / item_height_with_padding;
            const is_hovered = hovered_item == item_index;

            let scale = CAROUSEL_CONFIG.SCALE_FULL;
            let margin = 0;

            if (normalized_distance <= CAROUSEL_CONFIG.SCALE_THRESHOLD_NEAR) {
                scale = CAROUSEL_CONFIG.SCALE_FULL;
            } else if (normalized_distance <= CAROUSEL_CONFIG.SCALE_THRESHOLD_FAR) {
                const fade_factor = (normalized_distance - CAROUSEL_CONFIG.SCALE_THRESHOLD_NEAR) / CAROUSEL_CONFIG.FADE_RANGE;
                scale = lerp(CAROUSEL_CONFIG.SCALE_FULL, CAROUSEL_CONFIG.SCALE_MINIMUM, fade_factor);
            } else {
                scale = CAROUSEL_CONFIG.SCALE_MINIMUM;
            }

            if (is_hovered && item_index != selected) {
                scale = Math.min(scale * CAROUSEL_CONFIG.HOVER_SCALE_MULTIPLIER, CAROUSEL_CONFIG.HOVER_SCALE_MAX);
                margin = CAROUSEL_CONFIG.HOVER_MARGIN;
            }

            const cache_key = `${item_index}-${scale.toFixed(3)}-${margin}`;
            const cached_state = element_cache.get(element);

            if (cached_state != cache_key) {
                const height_px = Math.round(item_height_with_padding * scale);
                element.style.height = `${height_px}px`;
                element.style.setProperty("--scale-x", scale.toString());
                element.style.setProperty("--x-offset", "0px");
                element.style.setProperty("--margin", `${margin}px`);

                element_cache.set(element, cache_key);
            }
        }

        last_scroll_top = scroll_top;
        last_hovered_item = hovered_item;
    };

    const call_update = debounce((index) => {
        const actual_index = (index + 1) * columns;
        if (on_update) on_update(actual_index);
    }, 100);

    const carousel_update = () => {
        if (animation_frame_id) {
            return;
        }

        animation_frame_id = requestAnimationFrame(() => {
            update_carousel_effect();
            animation_frame_id = null;
        });
    };

    const handle_scroll = (e) => {
        scroll_top = e.target.scrollTop;
        if (carousel_enabled) carousel_update();
    };

    const handle_mouse_enter = (index) => {
        if (hovered_item == index) return;
        hovered_item = index;
        if (carousel_enabled && !is_scrolling) {
            carousel_update();
        }
    };

    const handle_mouse_leave = () => {
        if (hovered_item == -1) return;
        hovered_item = -1;
        if (carousel_enabled && !is_scrolling) {
            carousel_update();
        }
    };

    const update_height = () => {
        if (container) {
            container_height = container.clientHeight;
        }

        if (carousel_enabled && !is_scrolling) {
            carousel_update();
        }
    };

    const scroll_to_item = async (index) => {
        if (index < 0) {
            return;
        }

        await tick();

        if (!container) {
            return;
        }

        const target_scroll = columns_mode
            ? Math.floor(index / columns) * item_height_with_padding - container_height / 2 + item_height_with_padding / 2
            : index * item_height_with_padding - container_height / 2 + item_height_with_padding / 2;

        const distance = Math.abs(scroll_top - target_scroll);

        container.scrollTo({
            top: Math.max(0, target_scroll),
            behavior: distance > 2000 ? "instant" : "smooth"
        });
    };

    const get_column_items = (row_index) => {
        const items = [];
        const start_item = row_index * columns;
        for (let col = 0; col < columns; col++) {
            const item_index = start_item + col;
            if (item_index < count) {
                items.push(item_index);
            }
        }
        return items;
    };

    const reset = () => {
        element_cache.clear();
        hovered_item = -1;
    };

    // reset when key changes
    $: if (key) {
        reset();
    }

    $: if (selected != -1 && container) {
        scroll_to_item(selected);
    }

    $: if (carousel_enabled && container && visible_items > 0 && !is_scrolling) {
        carousel_update();
    }

    onMount(() => {
        update_height();

        if (selected != -1) {
            scroll_top = 0;
            if (container) {
                container.scrollTop = 0;
                tick().then(() => {
                    scroll_to_item(selected);
                });
            }
        }

        return () => {
            if (animation_frame_id) {
                cancelAnimationFrame(animation_frame_id);
            }

            if (scroll_timeout) {
                clearTimeout(scroll_timeout);
            }
        };
    });
</script>

<svelte:window on:resize={update_height} />

<div
    bind:this={container}
    class="virtual-list"
    class:osu-mode={carousel_enabled}
    class:columns-mode={columns_mode}
    style="height: {height};"
    on:scroll={handle_scroll}
    bind:clientHeight={container_height}
>
    <div class="spacer" style="height: {total_height}px;"></div>
    <div bind:this={viewport} class="viewport" style="transform: translateY({offset_y}px);">
        {#each { length: visible_items } as _, i (start_index + i)}
            <!-- only update on last item rendered -->
            {@const actual_index = start_index + i}
            {#if i == visible_items - 1 && on_update}
                {call_update(actual_index)}
            {/if}
            {#if columns_mode}
                {@const row_index = start_index + i}
                {@const column_items = get_column_items(row_index)}
                <div
                    class="row-container"
                    style="height: {item_height_with_padding}px; display: grid; grid-template-columns: repeat({columns}, 1fr); gap: 8px; width: 100%;"
                >
                    {#each column_items as item_index}
                        <div
                            id={crypto.randomUUID()}
                            class="item {direction} column-item"
                            style="height: {item_height_with_padding}px; width: 100%;"
                            on:mouseenter={() => handle_mouse_enter(item_index)}
                            on:mouseleave={handle_mouse_leave}
                            role="button"
                            tabindex="0"
                        >
                            <slot index={item_index} />
                        </div>
                    {/each}
                </div>
            {:else}
                <div
                    id={crypto.randomUUID()}
                    class="item {direction}"
                    class:carousel-effect={carousel_enabled}
                    style="width: {max_width
                        ? carousel_enabled
                            ? '98'
                            : '100'
                        : '80'}%; height: {item_height_with_padding}px; transform-origin: {direction} center; justify-self: {direction};"
                    on:mouseenter={() => handle_mouse_enter(actual_index)}
                    on:mouseleave={handle_mouse_leave}
                    role="button"
                    tabindex="0"
                >
                    <slot index={actual_index} />
                </div>
            {/if}
        {/each}
    </div>
</div>

<style>
    .virtual-list {
        position: relative;
        width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .spacer {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        pointer-events: none;
    }

    .viewport {
        position: absolute;
        top: 0;
        left: auto;
        right: 0;
        will-change: transform;
        width: 100%;
    }

    .item {
        cursor: pointer;
        contain: layout style paint;
    }

    .row-container {
        width: 100%;
        padding: 0 4px;
        contain: layout;
    }

    .column-item {
        border-radius: 4px;
    }

    .columns-mode .viewport {
        left: 0;
        right: auto;
    }

    .carousel-effect {
        transform: translateZ(0) scaleX(var(--scale-x, 1)) translateX(var(--x-offset, 0));
        backface-visibility: hidden;
        outline: 1px solid transparent;
        transition:
            transform 100ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
            opacity 100ms ease-out,
            margin 50ms ease-out;
        will-change: transform;
        margin-left: var(--margin, 0px);
    }

    .osu-mode {
        transform: translateZ(0);
    }

    @media (max-width: 768px) {
        .virtual-list::-webkit-scrollbar {
            width: 4px;
        }
    }
</style>
