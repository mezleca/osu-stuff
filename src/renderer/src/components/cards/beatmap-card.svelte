<script>
    import { onMount, onDestroy } from "svelte";

    // components
    import PreviewControl from "../utils/audio/preview-control.svelte";

    // icons
    import HeartFill from "../icon/heart-fill.svelte";
    import PlayCircle from "../icon/play-circle.svelte";

    // extra
    import PlaceholderImg from "../../assets/placeholder.png";

    export let selected = false,
        beatmap = {},
        show_bpm = true,
        show_star_rating = true,
        show_status = true,
        center = false,
        click = null,
        control = null,
        extra = null,
        set = false;

    let card_element;
    let image_element;
    let is_visible = false;
    let image_loaded = false;
    let observer = null;

    $: current_image_src = get_image_source(beatmap, is_visible, set);

    $: if (beatmap && current_image_src) {
        load_image(current_image_src);
    }

    const get_image_source = (beatmap, visible, is_set) => {
        if (!beatmap || !visible) return PlaceholderImg;

        if (is_set && beatmap?.covers?.cover) {
            return beatmap.covers.cover;
        }

        if (beatmap?.image_path) {
            return `media://${encodeURI(beatmap.image_path)}`;
        }

        if (beatmap?.beatmapset_id) {
            return `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`;
        }

        return PlaceholderImg;
    };

    const load_image = (src) => {
        if (!image_element || !src) {
            return;
        }

        // reset loading state when source changes
        image_loaded = false;

        // preload the current image
        const img = new Image();

        img.onload = () => {
            if (image_element && image_element.src != src) {
                image_element.src = src;
            }
            image_loaded = true;
        };

        img.onerror = () => {
            if (image_element && src != PlaceholderImg) {
                image_element.src = PlaceholderImg;
                image_loaded = true;
            }
        };

        img.src = src;
    };

    onMount(() => {
        observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !is_visible) {
                    is_visible = true;
                }
            },
            { threshold: 0.1, rootMargin: "50px" }
        );

        if (card_element) {
            observer.observe(card_element);
        }
    });

    onDestroy(() => {
        if (observer && card_element) {
            observer.unobserve(card_element);
        }
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if set}
    <div class="small-card" class:selected class:loaded={image_loaded} onclick={click} bind:this={card_element}>
        <img bind:this={image_element} class="bg-img" alt="" />
        <PreviewControl {beatmap} on_remove={control} />

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="set-info" onclick={extra} class:centered={center}>
            <div class="title">{beatmap?.title ?? "unknown"}</div>
            <div class="artist">by {beatmap?.artist ?? "unknown"}</div>
            <div class="mapper">mapped by {beatmap.creator ?? "unknown"}</div>
            <div class="stats">
                <span class="stat">{beatmap.status}</span>
                <div class="right-stats">
                    <div class="favorites">
                        <HeartFill />
                        <span>{beatmap.favourite_count}</span>
                    </div>
                    <div class="play-count">
                        <PlayCircle />
                        <span>{beatmap.play_count}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <div class="small-card" class:selected class:loaded={image_loaded} onclick={click} bind:this={card_element}>
        <img bind:this={image_element} class="bg-img" alt="" />
        <PreviewControl {beatmap} on_remove={control} />

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="info" onclick={extra} class:centered={center}>
            <div class="title">{beatmap?.title ?? "unknown"}</div>
            <div class="subtitle">by {beatmap?.artist ?? "unknown"}</div>
            <div class="mapper">mapped by {beatmap.mapper ?? "unknown"}</div>
            {#if show_status}
                <div class="stats">
                    <span class="stat">{beatmap?.status_text ?? "unknown"}</span>
                    <div class="right-stats">
                        {#if show_bpm}
                            <span class="stars">{Math.round(beatmap.bpm) ?? "0"} bpm</span>
                        {/if}
                        {#if show_star_rating}
                            <span class="stars">★ {beatmap?.star_rating?.[beatmap.mode].nm ?? 0}</span>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .small-card {
        position: relative;
        display: flex;
        overflow: hidden;
        cursor: pointer;
        border: 2px solid transparent;
        border-radius: 6px;
        height: 100px;
        transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        will-change: transform, filter;
        transform: translateZ(0);
        contain: layout style paint;
    }

    .bg-img {
        position: absolute;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        opacity: 0;
        transition: opacity 0.3s ease-out;
        display: block;
        min-height: 100px;
    }

    .small-card.loaded .bg-img {
        opacity: 1;
    }

    .selected {
        border-color: var(--accent-color);
    }

    .small-card::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        background: rgba(17, 20, 31, 0.65);
        transition: background 0.15s ease;
    }

    .small-card:hover::after {
        background: rgba(17, 20, 31, 0.45);
    }

    .small-card .info,
    .small-card .set-info {
        position: relative;
        z-index: 2;
        flex: 1;
        padding: 12px 10px;
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        justify-content: center;
    }

    .info.centered,
    .set-info.centered {
        align-items: center;
    }

    .small-card .title {
        font-size: 14px;
        color: #fff;
        margin: 0 0 2px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 280px;
        line-height: 1.2;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }

    .small-card .artist,
    .small-card .subtitle {
        font-size: 13px;
        color: #fff;
        margin: 0 0 4px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 300px;
        line-height: 1.2;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }

    .small-card .mapper {
        font-size: 11px;
        color: var(--text-secondary, #bbb);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 320px;
        line-height: 1.2;
    }

    .small-card .stats {
        display: flex;
        gap: 8px;
        align-items: center;
        position: relative;
        width: 100%;
        margin-top: auto;
    }

    .small-card .stars,
    .small-card .stat {
        color: var(--text-secondary);
        border-radius: 6px;
        font-size: 11px;
        padding: 4px 6px;
    }

    .small-card .stat {
        background: rgba(23, 23, 23, 0.75);
        text-transform: uppercase;
    }

    .small-card .stars {
        color: var(--text-color);
        font-size: 11px;
    }

    .right-stats {
        position: absolute;
        right: 0;
        display: flex;
        gap: 8px;
    }

    .play-count,
    .favorites {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: var(--text-color);
    }

    .small-card:hover :global(.preview-btn) {
        opacity: 1;
    }
</style>
