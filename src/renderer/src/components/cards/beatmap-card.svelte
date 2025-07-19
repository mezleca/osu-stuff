<script>
    import { onMount } from "svelte";

    import PreviewControl from "../utils/audio/preview-control.svelte";
    import PlaceholderImg from "../../assets/placeholder.png";

    export let selected = false,
        beatmap = {},
        show_bpm = true,
        show_star_rating = true,
        click = null,
        control = null,
        extra = null;

    let card_element;
    let is_visible = false;
    let bg_loaded = false;

    // lazy load background
    $: bg = is_visible && beatmap?.image_path ? `media://${encodeURI(beatmap.image_path)}` : PlaceholderImg;
    $: web_bg = beatmap?.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${beatmap?.beatmapset_id}/covers/cover.jpg` : PlaceholderImg;

    // use lazy loading for the background image
    onMount(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (let i = 0; i < entries.length; i++) {
                    const entry = entries[i];
                    if (entry.isIntersecting) {
                        is_visible = true;
                        observer.unobserve(entry.target);
                    }
                }
            },
            { threshold: 0.1, rootMargin: "50px" }
        );

        if (card_element) {
            observer.observe(card_element);
        }

        return () => {
            if (card_element) {
                observer.unobserve(card_element);
            }
        };
    });

    // preload the image
    $: if (is_visible) {
        const img = new Image();
        img.onload = () => (bg_loaded = true);
        if (web_bg == PlaceholderImg && bg == PlaceholderImg) {
            img.src = PlaceholderImg;
        } else {
            img.src = bg == PlaceholderImg ? web_bg : bg;
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="small-card" class:selected class:bg-loaded={bg_loaded} style="--card-bg: url({bg});" onclick={click} bind:this={card_element}>
    <PreviewControl {beatmap} on_remove={control} />
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="info" onclick={extra}>
        <div class="title">{beatmap?.title ?? "unknown"}</div>
        <div class="subtitle">{beatmap?.artist ?? "unknown"}</div>
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
    </div>
</div>

<style>
    .small-card {
        position: relative;
        display: flex;
        overflow: hidden;
        cursor: pointer;
        border: 2px solid transparent;
        border-radius: 6px;
        height: 90px;
        transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        will-change: transform, filter;
        transform: translateZ(0);
        contain: layout style paint;
    }

    .selected {
        border-color: var(--accent-color);
    }

    .small-card::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        background-image: var(--card-bg);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .small-card.bg-loaded::before {
        opacity: 1;
    }

    .small-card .info {
        position: relative;
        z-index: 2;
        flex: 1;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        background: rgba(17, 20, 31, 0.6);
        transition: 0.15s background;
    }

    .small-card .title {
        font-size: 14px;
        color: var(--text-color);
        margin-bottom: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 300px;
    }

    .small-card .subtitle {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 320px;
    }

    .small-card .stars,
    .small-card .stat {
        color: var(--text-secondary);
        border-radius: 6px;
        font-size: 11px;
        padding: 4px 6px;
    }

    .small-card .stat {
        background: rgb(23, 23, 23, 0.65);
    }

    .small-card .stats {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .small-card .stat {
        text-transform: uppercase;
    }

    .small-card .stars {
        color: var(--accent-pink);
        font-size: 11px;
    }

    .right-stats {
        position: absolute;
        right: 15px;
    }

    .small-card:hover :global(.preview-btn) {
        opacity: 1;
    }

    .small-card .info:hover {
        background: rgba(17, 20, 31, 0.4);
    }
</style>
