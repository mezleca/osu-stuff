<script>
    import { onDestroy } from "svelte";
    import { get_beatmap_data } from "../../lib/utils/beatmaps";

    // components
    import PreviewControl from "../utils/audio/preview-control.svelte";

    // fallback bg image
    import FallbackImage from "../../assets/images/fallback.png";

    // icons
    import HeartFill from "../icon/heart-fill.svelte";
    import PlayCircle from "../icon/play-circle.svelte";

    export let selected = false,
        highlighted = false,
        hash = null,
        show_bpm = true,
        show_star_rating = true,
        show_status = true,
        center = false,
        on_click = null,
        on_context = null,
        control = null,
        show_control = true,
        extra = null,
        set = false;

    const LOAD_DELAY = 30;

    let beatmap;
    let load_timeout;
    let card_element;
    let beatmap_loaded = false;
    let image_loaded = false;
    let image_src = "";

    const get_image_source = async () => {
        if (!beatmap) {
            console.log("failed to get image: beatmap is null");
            return FallbackImage;
        }

        if (set && beatmap?.covers?.cover) {
            return beatmap.covers.cover;
        }

        if (beatmap?.image_path) {
            const resolved_path = window.path.resolve(beatmap.image_path);
            const normalized_slashes = resolved_path.replace(/\\/g, "/");
            const media_uri = `media://${encodeURI(normalized_slashes)}`;
            return media_uri;
        }

        if (beatmap?.beatmapset_id) {
            return `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`;
        }

        return FallbackImage;
    };

    const load_beatmap = async () => {
        try {
            // get cached beatmap
            beatmap = await get_beatmap_data(hash);

            // update beatmap image
            image_src = await get_image_source();
        } catch (err) {
            console.error("failed to load beatmap:", hash, err);
        } finally {
            beatmap_loaded = true;
        }
    };

    const handle_click = () => {
        if (beatmap && on_click) on_click();
    };

    const handle_extra = () => {
        if (beatmap && extra) extra(beatmap);
    };

    const handle_context = (e) => {
        e?.preventDefault();
        if (beatmap && on_context) on_context(card_element, hash);
    };

    $: if (hash) {
        // prevent svelte from reusing shit
        beatmap = null;
        beatmap_loaded = false;
        image_loaded = false;

        // clear old tiemout
        if (load_timeout) {
            clearTimeout(load_timeout);
        }

        // load updated beatmap
        load_timeout = setTimeout(load_beatmap, LOAD_DELAY);
    }

    onDestroy(() => {
        if (load_timeout) clearTimeout(load_timeout);
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if !beatmap_loaded}
    <div style="height: 100px; width: 100%; background: rgba(17, 20, 31, 0.65);"></div>
{:else}
    <div
        class="small-card"
        class:selected
        class:highlighted
        class:loaded={image_loaded}
        onclick={handle_click}
        oncontextmenu={handle_context}
        bind:this={card_element}
    >
        <!-- render background image -->
        <img src={image_src} loading="lazy" onload={() => (image_loaded = true)} onerror={() => (image_loaded = true)} class="bg-img" alt="" />

        <!-- render audio control -->
        {#if show_control}
            <PreviewControl {beatmap} on_right={control} />
        {/if}

        <!-- render set information -->
        <div class={set ? "set-info" : "info"} onclick={handle_extra} class:centered={center}>
            <div class="title">{beatmap?.title ?? "unknown"}</div>
            <div class="artist">by {beatmap?.artist ?? "unknown"}</div>
            <div class="mapper">mapped by {beatmap.creator ?? "unknown"}</div>
            {#if show_status}
                <div class="stats">
                    <span class="stat">{beatmap[set ? "status" : "status_text"] ?? "unknown"}</span>
                    <div class="right-stats">
                        {#if set}
                            <!-- render favorites / playcount on set -->
                            <div class="favorites">
                                <HeartFill />
                                <span>{beatmap.favourite_count}</span>
                            </div>
                            <div class="play-count">
                                <PlayCircle />
                                <span>{beatmap.play_count}</span>
                            </div>
                        {:else}
                            <!-- render bpm / star rating on normal card -->
                            {#if show_bpm}
                                <span class="stars">{Math.round(beatmap?.bpm) ?? "0"} bpm</span>
                            {/if}
                            {#if show_star_rating}
                                <span class="stars">★ {beatmap?.star_rating?.[beatmap?.mode].nm ?? 0}</span>
                            {/if}
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
        z-index: 1;
    }

    .selected {
        border-color: var(--accent-color);
    }

    .highlighted {
        border-color: var(--accent-hover);
    }

    .bg-img:not([src]),
    .bg-img[src=""] {
        opacity: 0;
    }

    .small-card.loaded .bg-img {
        opacity: 1;
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

    .small-card .info,
    .small-card .set-info {
        position: relative;
        z-index: 2;
        flex: 1;
        padding: 12px 16px;
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

    .small-card .artist {
        font-size: 13px;
        color: #fff;
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
