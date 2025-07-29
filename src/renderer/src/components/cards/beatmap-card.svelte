<script>
    import { onMount } from "svelte";

    import PreviewControl from "../utils/audio/preview-control.svelte";
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

    $: bg = PlaceholderImg;
    $: web_bg = PlaceholderImg;
    $: display_bg = bg;
    $: set_data = null;

    $: if (beatmap) {
        update_card_data();
    }

    const update_card_data = () => {
        if (set) {
            // beatmapset logic
            bg = is_visible && beatmap?.covers?.cover ? beatmap.covers.cover : PlaceholderImg;
            web_bg = PlaceholderImg; // we already have the web URL
            display_bg = bg;

            // populate set data
            set_data = {};

            set_data.title = beatmap?.title ?? "unknown";
            set_data.artist = beatmap?.artist ?? "unknown";
            set_data.status_text = beatmap?.status ?? "unknown";
            set_data.bpm = beatmap?.bpm;
            set_data.max_sr = beatmap?.beatmaps ? Math.max(...beatmap.beatmaps.map((b) => b.difficulty_rating || 0)) : 0;
            set_data.diff_count = beatmap?.beatmaps?.length ?? 0;
        } else {
            bg = is_visible && beatmap?.image_path ? `media://${encodeURI(beatmap.image_path)}` : PlaceholderImg;
            web_bg = beatmap?.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${beatmap?.beatmapset_id}/covers/cover.jpg` : PlaceholderImg;
            display_bg = bg == PlaceholderImg && web_bg != PlaceholderImg ? web_bg : bg;
        }
    };

    // use lazy loading for the background image
    onMount(() => {
        update_card_data();

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

        if (set) {
            img.src = display_bg;
        } else {
            if (web_bg == PlaceholderImg && bg == PlaceholderImg) {
                img.src = PlaceholderImg;
            } else {
                img.src = bg == PlaceholderImg ? web_bg : bg;
            }
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if set}
    {#if set_data}
        <div
            class="set-card"
            class:selected
            class:bg-loaded={bg_loaded}
            style="--card-bg: url({display_bg});"
            onclick={click}
            bind:this={card_element}
        >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="info" onclick={extra}>
                <div class="title">{set_data.title}</div>
                <div class="subtitle">{set_data.artist}</div>
                <div class="stats">
                    {#if show_beatmap_status}
                        <span class="stat">{set_data.status_text}</span>
                    {/if}
                    <div class="right-stats">
                        <span class="diff-count">{set_data.diff_count} diffs</span>
                        {#if show_bpm}
                            <span class="stars">{Math.round(set_data.bpm)} bpm</span>
                        {/if}
                        {#if show_star_rating}
                            <span class="stars">★ {set_data.max_star_rating}</span>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
{:else}
    <div class="small-card" class:selected class:bg-loaded={bg_loaded} style="--card-bg: url({display_bg});" onclick={click} bind:this={card_element}>
        <PreviewControl {beatmap} on_remove={control} />
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="info" onclick={extra}>
            <div class="title">{beatmap?.title ?? "unknown"}</div>
            <div class="subtitle">{beatmap?.artist ?? "unknown"}</div>
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
    .small-card,
    .set-card {
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

    .small-card::before,
    .set-card::before {
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

    .small-card.bg-loaded::before,
    .set-card.bg-loaded::before {
        opacity: 1;
    }

    .small-card .info,
    .set-card .info {
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

    .small-card .title,
    .set-card .title {
        font-size: 14px;
        color: var(--text-color);
        margin-bottom: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 300px;
    }

    .small-card .subtitle,
    .set-card .subtitle {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 320px;
    }

    .small-card .stars,
    .set-card .stars,
    .small-card .stat,
    .set-card .stat,
    .diff-count {
        color: var(--text-secondary);
        border-radius: 6px;
        font-size: 11px;
        padding: 4px 6px;
    }

    .small-card .stat,
    .set-card .stat {
        background: rgb(23, 23, 23, 0.65);
    }

    .small-card .stats,
    .set-card .stats {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .small-card .stat,
    .set-card .stat {
        text-transform: uppercase;
    }

    .small-card .stars,
    .set-card .stars {
        color: var(--accent-pink);
        font-size: 11px;
    }

    .diff-count {
        color: var(--accent-blue);
        font-size: 11px;
    }

    .right-stats {
        position: absolute;
        right: 15px;
        display: flex;
        gap: 8px;
    }

    .small-card:hover :global(.preview-btn),
    .set-card:hover :global(.preview-btn) {
        opacity: 1;
    }

    .small-card .info:hover,
    .set-card .info:hover {
        background: rgba(17, 20, 31, 0.4);
    }
</style>
