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
    export let selected = -1;

    let container;
    let hovered_item = -1;
    let container_height = 0;
    let scroll_top = 0;
    let animation_frame_id = null;
    let last_scroll_top = -1;
    let last_hovered_item = -1;

    $: total_height = count * item_height;
    $: start_index = Math.max(0, Math.floor(scroll_top / item_height) - buffer);
    $: visible_count = Math.ceil(container_height / item_height) + buffer * 2;
    $: end_index = Math.min(start_index + visible_count, count);
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
        if (!carousel || !container) {
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
            if (element.style.height !== height_px + "px") {
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
        if (carousel) carousel_update();
    };

    const handle_mouse_enter = (index) => {
        if (hovered_item == index) return;
        hovered_item = index;
        if (carousel) carousel_update();
    };

    const handle_mouse_leave = () => {
        if (hovered_item == -1) return;
        hovered_item = -1;
        if (carousel) carousel_update();
    };

    const update_height = () => {
        if (container) container_height = container.clientHeight;
        if (carousel) carousel_update();
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

        const target_scroll = index * item_height - container_height / 2 + item_height / 2;
        const distance = Math.abs(scroll_top - target_scroll);

        container.scrollTo({
            top: Math.max(0, target_scroll),
            behavior: distance > 2000 ? "instant" : "smooth"
        });
    };

    export const get_center_item_index = () => {
        return Math.round((scroll_top + container_height / 2) / item_height);
    };

    // automatic scroll on change
    $: if (selected != -1 && container) {
        scroll_to_item(selected);
    }

    // updata carousel effect when needed
    $: if (carousel && container && (visible_items > 0 || count == 0)) {
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
    class:osu-mode={carousel}
    style="height: {height};"
    on:scroll={handle_scroll}
    bind:clientHeight={container_height}
>
    <div class="spacer" style="height: {total_height}px;"></div>
    <div class="viewport" style="transform: translateY({offset_y}px);">
        {#key key}
            {#each { length: visible_items } as _, i (start_index + i)}
                <div
                    id={get_key(i)}
                    class="item {direction}"
                    class:osu-effect={carousel}
                    style="width: {max_width
                        ? carousel
                            ? '98'
                            : '100'
                        : '80'}%; height: {item_height}px; transform-origin: {direction} center; justify-self: {direction};"
                    on:mouseenter={() => handle_mouse_enter(start_index + i)}
                    on:mouseleave={handle_mouse_leave}
                    role="button"
                    tabindex="0"
                >
                    <slot index={start_index + i} />
                </div>
            {/each}
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

    .osu-effect {
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
