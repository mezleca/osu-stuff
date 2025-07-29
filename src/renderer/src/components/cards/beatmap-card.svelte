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
        show_beatmap_status = true,
        click = null,
        control = null,
        extra = null,
        set = false;

    let card_element;
    let is_visible = false;
    let bg_loaded = false;
    let observer = null;

    $: display_bg = PlaceholderImg;

    $: if (beatmap) {
        reset_loading_state();
        update_card_data();
    }

    const reset_loading_state = () => {
        bg_loaded = false;
        display_bg = PlaceholderImg;
    };

    const update_card_data = () => {
        if (!beatmap) {
            return;
        }

        let target,
            fallback = PlaceholderImg;

        if (set && is_visible && beatmap?.covers?.cover) {
            target = beatmap.covers.cover;
        } else {
            const local = is_visible && beatmap?.image_path ? `media://${encodeURI(beatmap.image_path)}` : PlaceholderImg;
            const web = beatmap?.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${beatmap?.beatmapset_id}/covers/cover.jpg` : PlaceholderImg;

            target = local;
            fallback = web;
        }

        // use web bg if local is not available
        if (target == PlaceholderImg && fallback != PlaceholderImg) {
            target = fallback;
        }

        if (target != display_bg) {
            load_image(target);
        }
    };

    // @TODO: this is causing some weird flicks on load
    const load_image = (src) => {
        bg_loaded = false;

        const img = new Image();

        img.onload = () => {
            display_bg = src;
            bg_loaded = true;
        };

        img.onerror = () => {
            display_bg = PlaceholderImg;
            bg_loaded = true;
        };

        img.src = src;
    };

    onMount(() => {
        observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !is_visible) {
                    is_visible = true;
                    update_card_data();
                }
            },
            { threshold: 0.1, rootMargin: "50px" }
        );

        if (card_element) {
            observer.observe(card_element);
        }

        update_card_data();
    });

    onDestroy(() => {
        if (observer && card_element) {
            observer.unobserve(card_element);
        }
        reset_loading_state();
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if set}
    <div class="small-card" class:selected class:loaded={bg_loaded} onclick={click} bind:this={card_element}>
        <img class="bg-img" src={display_bg} alt="" aria-hidden="true" />
        <PreviewControl {beatmap} on_remove={control} />

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="set-info" onclick={extra}>
            <div class="title">{beatmap?.title ?? "unknown"}</div>
            <div class="artist">by {beatmap?.artist ?? "unknown"}</div>
            <div class="mapper">mapped by {beatmap.creator ?? "unknown"}</div>
            <div class="stats">
                {#if show_beatmap_status}
                    <span class="stat">{beatmap.status}</span>
                {/if}
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
    <div class="small-card" class:selected class:loaded={bg_loaded} onclick={click} bind:this={card_element}>
        <img class="bg-img" src={display_bg} alt="" aria-hidden="true" />
        <PreviewControl {beatmap} on_remove={control} />

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="info" onclick={extra}>
            <div class="title">{beatmap?.title ?? "unknown"}</div>
            <div class="subtitle">by {beatmap?.artist ?? "unknown"}</div>
            <div class="mapper">mapped by {beatmap.mapper ?? "unknown"}</div>
            <div class="stats">
                {#if show_beatmap_status}
                    <span class="stat">{beatmap?.status_text ?? "unknown"}</span>
                {/if}
                <div class="right-stats">
                    {#if show_bpm}
                        <span class="stars">{Math.round(beatmap.bpm) ?? "0"} bpm</span>
                    {/if}
                    {#if show_star_rating}
                        <span class="stars">★ {beatmap?.star_rating?.[beatmap.mode].nm ?? 0}</span>
                    {/if}
                </div>
            </div>
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
        min-width: 100%;
        max-height: 100%;
        object-fit: cover;
        object-position: center;
        opacity: 0;
        transition: opacity 0.25s ease-in;
        display: block;
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
        padding: 8px 12px 10px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        width: 100%;
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
        margin: 0 0 auto 0;
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
