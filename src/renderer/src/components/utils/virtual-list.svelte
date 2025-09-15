<script>
    import { onMount, tick } from "svelte";

    export let items = [];
    export let count = 0;
    export let item_height = 100;
    export let buffer = 5;
    export let extra = 0; // create extra spacing on end if we have more than 10 items
    export let height = "100%";
    export let carousel = false;
    export let max_width = false;
    export let key = crypto.randomUUID();
    export let direction = "right";
    export let on_update = () => {};
    export let selected = -1;
    export let columns = null;

    let container;
    let hovered_item = -1;
    let container_height = 0;
    let scroll_top = 0;
    let animation_frame_id = null;
    let target_scroll = 0;
    let last_scroll_top = -1;
    let last_hovered_item = -1;
    let padding = 10;
    let scroll_timeout = null;
    let is_scrolling = false;

    let scroll_animation_id = null;
    let scroll_start_time = null;
    let scroll_animation_duration = 250;
    let start_scroll = 0;

    // cache for element styles
    let element_cache = new WeakMap();

    $: columns_mode = columns && columns > 1;
    $: carousel_enabled = carousel && !columns_mode;

    $: rows_per_screen = columns_mode ? Math.ceil(count / Math.max(columns, 1)) : count > 10 ? count + extra : count;
    $: item_height_with_padding = item_height + padding;
    $: total_height = rows_per_screen * item_height_with_padding;
    $: start_index = Math.max(0, Math.floor(scroll_top / item_height_with_padding) - buffer);
    $: visible_count = Math.ceil(container_height / item_height_with_padding) + buffer * 2;
    $: end_index = Math.min(start_index + visible_count, rows_per_screen);
    $: visible_items = Math.max(0, end_index - start_index);
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

    const ease_out = (e, d) => {
        const t = e / d;
        return 1 - Math.pow(1 - t, 3);
    };

    const update_carousel_effect = () => {
        if (!carousel_enabled || !container) {
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

        // clear existing timeout and set scroll state
        if (scroll_timeout) {
            clearTimeout(scroll_timeout);
        }

        is_scrolling = true;

        scroll_timeout = setTimeout(() => {
            is_scrolling = false;
            if (carousel_enabled) {
                carousel_update();
            }
        }, 20);

        // update carousel effect
        if (carousel_enabled) {
            carousel_update();
        }
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

    const clear_scroll_animation = () => {
        scroll_animation_id = null;
        scroll_start_time = 0;
        start_scroll = 0;
    };

    const animate_scroll = (currentTime) => {
        if (!container) {
            return;
        }

        if (!scroll_start_time) {
            scroll_start_time = currentTime;
            start_scroll = container.scrollTop;
        }

        const elapsed = currentTime - scroll_start_time;

        if (elapsed < scroll_animation_duration) {
            const t = ease_out(elapsed, scroll_animation_duration);
            const new_scroll = lerp(start_scroll, target_scroll, t);
            container.scrollTop = new_scroll;
            scroll_animation_id = requestAnimationFrame(animate_scroll);
        } else {
            container.scrollTop = target_scroll;
            clear_scroll_animation();
        }
    };

    export const scroll_to_item = async (index) => {
        if (index < 0) {
            return;
        }

        await tick();

        if (!container) {
            console.log("fukcing container not found...");
            return;
        }

        // cancel existing animation
        clear_scroll_animation();

        // calculate target
        target_scroll = columns_mode
            ? Math.floor(index / columns) * item_height_with_padding - container_height / 2 + item_height_with_padding / 2
            : index * item_height_with_padding - container_height / 2 + item_height_with_padding / 2;

        target_scroll = Math.max(0, Math.min(target_scroll, total_height - container_height));
        const distance = Math.abs(target_scroll - container.scrollTop);

        // force old instant behaviour
        if (distance > 2000) {
            container.scrollTo({
                top: target_scroll,
                behavior: "instant"
            });
        } else {
            // start animation
            scroll_animation_id = requestAnimationFrame(animate_scroll);
        }
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
        element_cache = new WeakMap();
        hovered_item = -1;
    };

    // automatically scroll to item on selected item update
    $: if (selected != -1) {
        scroll_to_item(selected);
    }

    // update carrousel on scroll update
    $: if (carousel_enabled && visible_items > 0) {
        carousel_update();
    }

    // reset cache when key changes
    $: if (key) {
        reset();
    }

    onMount(() => {
        update_height();

        // on destroy
        return () => {
            if (animation_frame_id) {
                cancelAnimationFrame(animation_frame_id);
            }

            clear_scroll_animation();

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
    <div class="viewport" style="transform: translateY({offset_y}px);">
        {#each Array(visible_items) as _, i (items[start_index + i] ?? start_index + i)}
            {@const actual_index = start_index + i}
            {@const key = items[actual_index] ?? actual_index}
            <!-- only update on last item rendered -->
            {#if columns_mode}
                {@const row_index = start_index + i}
                {@const column_items = get_column_items(row_index)}
                <div
                    class="row-container"
                    style="height: {item_height_with_padding}px; display: grid; grid-template-columns: repeat({columns}, 1fr); gap: 8px; width: 100%;"
                >
                    {#each column_items as item_index}
                        {#if on_update}
                            {on_update(item_index)}
                        {/if}
                        <div
                            id={key}
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
                {#if on_update}
                    {on_update(actual_index)}
                {/if}
                <div
                    id={key}
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
        scroll-behavior: auto;
        overscroll-behavior: contain;
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
        contain: layout style paint;
        transform: translateZ(0);
    }

    .item {
        cursor: pointer;
        contain: layout style paint;
        will-change: contents;
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
