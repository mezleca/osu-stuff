<script lang="ts">
    import { onMount, tick } from "svelte";

    interface CarouselConfig {
        SCALE_THRESHOLD_NEAR: number;
        SCALE_THRESHOLD_FAR: number;
        FADE_RANGE: number;
        SCALE_FULL: number;
        SCALE_MINIMUM: number;
        HOVER_SCALE_MULTIPLIER: number;
        HOVER_SCALE_MAX: number;
        HOVER_MARGIN: number;
    }

    interface ScrollAnimationState {
        animation_id: number | null;
        start_time: number;
        duration: number;
        start_scroll: number;
        target_scroll: number;
    }

    interface CarouselTransform {
        scale: number;
        margin: number;
    }

    export let items: any[] = [];
    export let count: number = 0;
    export let item_height: number = 100;
    export let buffer: number = 5;
    export let extra: number = 0;
    export let height: string = "100%";
    export let carousel: boolean = false;
    export let max_width: boolean = false;
    export let key: string = crypto.randomUUID();
    export let direction: "left" | "right" | "center" = "right";
    export let on_update: ((index: number) => void) | null = null;
    export let selected: number = -1;
    export let columns: number | null = null;

    const PADDING = 10;
    const SCROLL_DEBOUNCE_MS = 20;
    const SCROLL_ANIMATION_DURATION_MS = 250;
    const INSTANT_SCROLL_THRESHOLD = 2000;
    const LARGE_LIST_THRESHOLD = 10;

    const CAROUSEL_CONFIG: CarouselConfig = {
        SCALE_THRESHOLD_NEAR: 0.5,
        SCALE_THRESHOLD_FAR: 2.0,
        FADE_RANGE: 1.5,
        SCALE_FULL: 1.0,
        SCALE_MINIMUM: 0.95,
        HOVER_SCALE_MULTIPLIER: 1.01,
        HOVER_SCALE_MAX: 1.03,
        HOVER_MARGIN: 8
    };

    let container: HTMLDivElement;
    let hovered_item: number = -1;
    let container_height: number = 0;
    let scroll_top: number = 0;
    let animation_frame_id: number | null = null;
    let scroll_timeout: ReturnType<typeof setTimeout> | null = null;
    let is_scrolling: boolean = false;

    let scroll_animation: ScrollAnimationState = {
        animation_id: null,
        start_time: 0,
        duration: SCROLL_ANIMATION_DURATION_MS,
        start_scroll: 0,
        target_scroll: 0
    };

    let element_cache = new WeakMap<Element, string>();

    $: columns_mode = columns && columns > 1;
    $: carousel_enabled = carousel && !columns_mode;
    $: rows_per_screen = columns_mode ? Math.ceil(count / Math.max(columns, 1)) : count > LARGE_LIST_THRESHOLD ? count + extra : count;
    $: item_height_with_padding = item_height + PADDING;
    $: total_height = rows_per_screen * item_height_with_padding;
    $: start_index = Math.max(0, Math.floor(scroll_top / item_height_with_padding) - buffer);
    $: visible_count = Math.ceil(container_height / item_height_with_padding) + buffer * 2;
    $: end_index = Math.min(start_index + visible_count, rows_per_screen);
    $: visible_items = Math.max(0, end_index - start_index);

    const lerp = (start: number, end: number, factor: number): number => {
        return start + (end - start) * factor;
    };

    const ease_out = (elapsed: number, duration: number): number => {
        const t = elapsed / duration;
        return 1 - Math.pow(1 - t, 3);
    };

    const calculate_carousel_transform = (
        distance_from_center: number,
        item_height: number,
        is_hovered: boolean,
        is_selected: boolean
    ): CarouselTransform => {
        const normalized_distance = distance_from_center / item_height;
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

        if (is_hovered && !is_selected) {
            scale = Math.min(scale * CAROUSEL_CONFIG.HOVER_SCALE_MULTIPLIER, CAROUSEL_CONFIG.HOVER_SCALE_MAX);
            margin = CAROUSEL_CONFIG.HOVER_MARGIN;
        }

        return { scale, margin };
    };

    const update_carousel_effect = (): void => {
        if (!carousel_enabled || !container) {
            return;
        }

        const center_y = scroll_top + container_height / 2;
        const elements = [...container.querySelectorAll(".item")];

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i] as HTMLElement;
            const item_index = start_index + i;

            if (!element || item_index >= count) {
                continue;
            }

            const item_center_y = item_index * item_height_with_padding + item_height_with_padding / 2;
            const distance_from_center = Math.abs(item_center_y - center_y);
            const is_hovered = hovered_item == item_index;
            const is_selected = selected == item_index;

            const { scale, margin } = calculate_carousel_transform(distance_from_center, item_height_with_padding, is_hovered, is_selected);

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
    };

    const carousel_update = (): void => {
        if (animation_frame_id) {
            return;
        }

        animation_frame_id = requestAnimationFrame(() => {
            update_carousel_effect();
            animation_frame_id = null;
        });
    };

    const handle_scroll = (e: Event): void => {
        scroll_top = (e.target as HTMLElement).scrollTop;

        if (scroll_timeout) {
            clearTimeout(scroll_timeout);
        }

        is_scrolling = true;

        scroll_timeout = setTimeout(() => {
            is_scrolling = false;
            if (carousel_enabled) {
                carousel_update();
            }
        }, SCROLL_DEBOUNCE_MS);

        if (carousel_enabled) {
            carousel_update();
        }
    };

    const handle_mouse_enter = (index: number): void => {
        if (hovered_item == index) return;
        hovered_item = index;
        if (carousel_enabled && !is_scrolling) {
            carousel_update();
        }
    };

    const handle_mouse_leave = (): void => {
        if (hovered_item == -1) return;
        hovered_item = -1;
        if (carousel_enabled && !is_scrolling) {
            carousel_update();
        }
    };

    const clear_scroll_animation = (): void => {
        scroll_animation.animation_id = null;
        scroll_animation.start_time = 0;
        scroll_animation.start_scroll = 0;
    };

    const animate_scroll = (current_time: number): void => {
        if (!container) {
            return;
        }

        if (!scroll_animation.start_time) {
            scroll_animation.start_time = current_time;
            scroll_animation.start_scroll = container.scrollTop;
        }

        const elapsed = current_time - scroll_animation.start_time;

        if (elapsed < scroll_animation.duration) {
            const t = ease_out(elapsed, scroll_animation.duration);
            const new_scroll = lerp(scroll_animation.start_scroll, scroll_animation.target_scroll, t);
            container.scrollTop = new_scroll;
            scroll_animation.animation_id = requestAnimationFrame(animate_scroll);
        } else {
            container.scrollTop = scroll_animation.target_scroll;
            clear_scroll_animation();
        }
    };

    export const scroll_to_item = async (index: number): Promise<void> => {
        if (index < 0) {
            return;
        }

        await tick();

        if (!container) {
            return;
        }

        clear_scroll_animation();

        scroll_animation.target_scroll = columns_mode
            ? Math.floor(index / columns!) * item_height_with_padding - container_height / 2 + item_height_with_padding / 2
            : index * item_height_with_padding - container_height / 2 + item_height_with_padding / 2;

        scroll_animation.target_scroll = Math.max(0, Math.min(scroll_animation.target_scroll, total_height - container_height));

        const distance = Math.abs(scroll_animation.target_scroll - container.scrollTop);

        if (distance > INSTANT_SCROLL_THRESHOLD) {
            container.scrollTo({
                top: scroll_animation.target_scroll,
                behavior: "instant"
            });
        } else {
            scroll_animation.animation_id = requestAnimationFrame(animate_scroll);
        }
    };

    const get_column_items = (row_index: number): number[] => {
        const items: number[] = [];
        const start_item = row_index * columns!;
        for (let col = 0; col < columns!; col++) {
            const item_index = start_item + col;
            if (item_index < count) {
                items.push(item_index);
            }
        }
        return items;
    };

    const update_height = (): void => {
        if (container) {
            container_height = container.clientHeight;
        }

        if (carousel_enabled && !is_scrolling) {
            carousel_update();
        }
    };

    const reset = (): void => {
        element_cache = new WeakMap();
        hovered_item = -1;
    };

    $: if (selected != -1) {
        scroll_to_item(selected);
    }

    $: if (carousel_enabled && visible_items > 0) {
        carousel_update();
    }

    $: if (key) {
        reset();
    }

    onMount(() => {
        update_height();

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
    {#each Array(visible_items) as _, i (items[start_index + i] ?? start_index + i)}
        {@const actual_index = start_index + i}
        {@const key = items[actual_index] ?? actual_index}
        {@const top_pos = actual_index * item_height_with_padding}
        {@const z_index = count - actual_index}

        {#if columns_mode}
            {@const row_index = start_index + i}
            {@const column_items = get_column_items(row_index)}
            {@const row_top_pos = row_index * item_height_with_padding}

            <div
                class="row-container"
                style="display: grid; grid-template-columns: repeat({columns}, 1fr); gap: 8px; width: 100%; position: absolute; top: {row_top_pos}px; left: 0; right: 0;"
                data-index={row_index}
            >
                {#each column_items as item_index}
                    {#if on_update}
                        {on_update(item_index)}
                    {/if}
                    <div
                        id={key}
                        class="item {direction} column-item"
                        style="width: 100%;"
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
                style="
                    position: absolute;
                    top: {top_pos}px;
                    width: {max_width ? (carousel_enabled ? '98' : '100') : '80'}%; 
                    transform-origin: {direction} center; 
                    z-index: {z_index};
                "
                on:mouseenter={() => handle_mouse_enter(actual_index)}
                on:mouseleave={handle_mouse_leave}
                data-index={actual_index}
                role="button"
                tabindex="0"
            >
                <slot index={actual_index} />
            </div>
        {/if}
    {/each}
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

    .item {
        cursor: pointer;
        will-change: contents;
        overflow: visible;
    }

    .item.center {
        left: 0;
        right: 0;
        margin: 0 auto;
    }

    .item.right {
        right: 0;
        left: auto;
        margin: 0;
    }

    .item.left {
        left: 0;
        right: auto;
        margin: 0;
    }

    .row-container {
        width: 100%;
        padding: 0 4px;
        contain: layout;
    }

    .column-item {
        border-radius: 4px;
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
