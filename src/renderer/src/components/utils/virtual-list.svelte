<script>
    import { onMount, tick, onDestroy } from "svelte";

    // props
    export let count = 0;
    export let item_height = 100;
    export let buffer = 6;
    export let height = "100%";
    export let carousel = false;
    export let max_width = false;
    export let key = crypto.randomUUID();
    export let direction = "right";
    export let get_key = () => crypto.randomUUID();
    export let on_end = () => {};
    export let selected = -1;
    export let columns = null;

    let container;
    let hovered_item = -1;
    let container_height = 0;
    let scroll_top = 0;
    let animation_frame_id = null;
    let last_scroll_top = -1;
    let last_hovered_item = -1;

    $: columns_mode = columns && columns > 1;
    $: carousel_enabled = carousel && !columns_mode;

    $: rows_per_screen = columns_mode ? Math.ceil(count / columns) : count;
    $: item_height = columns_mode ? item_height : item_height;
    $: total_height = rows_per_screen * item_height;
    $: start_index = Math.max(0, Math.floor(scroll_top / item_height) - buffer);
    $: visible_count = Math.ceil(container_height / item_height) + buffer * 2;
    $: end_index = Math.min(start_index + visible_count, rows_per_screen);
    $: visible_items = end_index - start_index;
    $: offset_y = start_index * item_height;

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
        if (!carousel_enabled || !container) {
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
            const item_center_y = item_index * item_height + item_height / 2;
            const distance_from_center = Math.abs(item_center_y - center_y);
            const normalized_distance = distance_from_center / item_height;
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

            // hover effect
            if (is_hovered && item_index != selected) {
                scale = Math.min(scale * CAROUSEL_CONFIG.HOVER_SCALE_MULTIPLIER, CAROUSEL_CONFIG.HOVER_SCALE_MAX);
                margin = CAROUSEL_CONFIG.HOVER_MARGIN;
            }

            const height_px = Math.round(item_height * scale);
            if (element.style.height != height_px + "px") {
                element.style.height = height_px + "px";
            }

            // apply transforms
            element.style.setProperty("--scale-x", scale);
            element.style.setProperty("--x-offset", `0px`);
            element.style.setProperty("--margin", `${margin}px`);
        }

        last_scroll_top = scroll_top;
        last_hovered_item = hovered_item;
    };

    const carousel_update = () => {
        // wait
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
        if (carousel_enabled) carousel_update();
    };

    const handle_mouse_leave = () => {
        if (hovered_item == -1) return;
        hovered_item = -1;
        if (carousel_enabled) carousel_update();
    };

    const update_height = () => {
        if (container) container_height = container.clientHeight;
        if (carousel_enabled) carousel_update();
    };

    export const scroll_to_item = async (index) => {
        if (index < 0) {
            return;
        }

        await tick();

        // what
        if (!container) {
            console.log("container 404");
            return;
        }

        const target_scroll = columns_mode
            ? Math.floor(index / columns) * item_height - container_height / 2 + item_height / 2
            : index * item_height - container_height / 2 + item_height / 2;

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

    // automatic scroll on change
    $: if (selected != -1 && container) {
        scroll_to_item(selected);
    }

    // update carousel effect when needed
    $: if (carousel_enabled && container && (visible_items > 0 || count == 0)) {
        carousel_update();
    }

    // reset hovered if we have nothing t
    $: if (container && (count == 0 || key)) {
        hovered_item = -1;
    }

    onMount(() => {
        update_height();

        if (selected != -1) {
            // reset scroll
            scroll_top = 0;

            // reset container scroll and if we have a selected item, scroll to them
            if (container) {
                container.scrollTop = 0;
                tick().then(() => {
                    scroll_to_item(selected);
                });
            }
        }
    });

    onDestroy(() => {
        if (animation_frame_id) {
            cancelAnimationFrame(animation_frame_id);
        }
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
        {#key key}
            {#if columns_mode}
                {#each { length: visible_items } as _, i (start_index + i)}
                    {@const actual_index = start_index + i}
                    {#if actual_index == count - 1}
                        {on_end()}
                    {/if}
                    {@const row_index = start_index + i}
                    {@const column_items = get_column_items(row_index)}
                    <div
                        class="row-container"
                        style="height: {item_height}px; display: grid; grid-template-columns: repeat({columns}, 1fr); gap: 8px; width: 100%;"
                    >
                        {#each column_items as item_index}
                            <div
                                id={get_key(item_index)}
                                class="item {direction} column-item"
                                style="height: {item_height}px; width: 100%;"
                                on:mouseenter={() => handle_mouse_enter(item_index)}
                                on:mouseleave={handle_mouse_leave}
                                role="button"
                                tabindex="0"
                            >
                                <slot index={item_index} />
                            </div>
                        {/each}
                    </div>
                {/each}
            {:else}
                {#each { length: visible_items } as _, i (start_index + i)}
                    {@const actual_index = start_index + i}
                    {#if actual_index == count - 1}
                        {on_end()}
                    {/if}
                    <div
                        id={get_key(i)}
                        class="item {direction}"
                        class:carousel-effect={carousel_enabled}
                        style="width: {max_width
                            ? carousel_enabled
                                ? '98'
                                : '100'
                            : '80'}%; height: {item_height}px; transform-origin: {direction} center; justify-self: {direction};"
                        on:mouseenter={() => handle_mouse_enter(actual_index)}
                        on:mouseleave={handle_mouse_leave}
                        role="button"
                        tabindex="0"
                    >
                        <slot index={actual_index} />
                    </div>
                {/each}
            {/if}
        {/key}
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
    }

    .row-container {
        width: 100%;
        padding: 0 4px;
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
            transform 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
            opacity 150ms ease-out,
            margin 100ms ease-out;
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
