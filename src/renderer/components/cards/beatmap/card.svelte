<script lang="ts">
    import { get_formatted_star_rating, type BeatmapCardFlags } from "../../../lib/utils/beatmap-card";
    import { get_placeholder_image, get_status_style } from "../../../lib/utils/card-utils";
    import type { IBeatmapResult } from "@shared/types";

    import BeatmapControls from "../beatmap-controls.svelte";
    import FadingImage from "../../utils/fading-image.svelte";

    export let beatmap: IBeatmapResult | null = null;
    export let flags: BeatmapCardFlags;
    export let selected = false;
    export let highlighted = false;
    export let centered = false;
    export let height = 100;
    export let background = "";
    export let hash = "";
    export let has_map = false;
    export let on_click: (event: MouseEvent) => void = null;
    export let on_contextmenu: (event: MouseEvent) => void = null;
    export let on_remove: (checksum: string) => void = null;
    export let on_download: () => void = null;

    const placeholder_image = get_placeholder_image();

    $: status_style = get_status_style(beatmap?.status);
    $: formatted_star_rating = get_formatted_star_rating(beatmap);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="beatmap-card"
    style={`height: ${height}px;`}
    class:selected
    class:highlighted
    class:temp={beatmap?.temp}
    onclick={on_click}
    oncontextmenu={on_contextmenu}
>
    <div class="beatmap-card-image-frame">
        <FadingImage class_name="beatmap-card-background" src={background} fallback={placeholder_image} />
    </div>

    {#if flags.show_extra_actions}
        <BeatmapControls
            beatmapset_id={beatmap?.beatmapset_id ?? -1}
            show_remove={flags.show_action_remove}
            {hash}
            {has_map}
            {on_remove}
            {on_download}
        />
    {/if}

    <div class="beatmap-card-metadata" class:centered>
        <div class="title">{beatmap?.title ?? "unknown"}</div>
        <div class="artist">by {beatmap?.artist ?? "unknown"}</div>
        <div class="creator">mapped by {beatmap?.creator ?? "unknown"}</div>
        {#if flags.show_status}
            <div class="beatmap-card-extra">
                <span class="status" style={`background-color: ${status_style.background}; color: ${status_style.text};`}>
                    {beatmap?.status ?? "unknown"}
                </span>
                {#if flags.show_bpm}
                    <span class="bpm">{Math.round(beatmap?.bpm ?? 0)} bpm</span>
                {/if}
                {#if flags.show_star_rating}
                    <span class="star-rating">★ {formatted_star_rating}</span>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .beatmap-card {
        position: relative;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        cursor: pointer;
        border: 2px solid transparent;
        border-radius: 6px;
        transition:
            height 0.2s ease-in-out,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        contain: layout style paint;
    }

    .beatmap-card.temp {
        border-color: red;
    }

    .beatmap-card.selected {
        border-color: var(--accent-color);
    }

    .beatmap-card.highlighted {
        border-color: var(--accent-hover);
    }

    .beatmap-card-image-frame {
        position: absolute;
        inset: 0;
        z-index: 1;
        background-position: center;
        background-size: cover;
    }

    .beatmap-card-image-frame :global(.beatmap-card-background) {
        width: 100%;
        height: 100%;
        min-height: 100px;
        object-fit: cover;
        object-position: center;
        display: block;
        filter: brightness(0.5);
    }

    .beatmap-card :global(.card-control) {
        position: absolute;
        top: 10px;
        right: 10px;
    }

    .beatmap-card :global(.control-btn) {
        opacity: 0;
    }

    .beatmap-card:hover :global(.control-btn) {
        opacity: 1;
    }

    .beatmap-card-metadata {
        position: relative;
        z-index: 2;
        width: 100%;
        height: 100%;
        padding: 12px 16px;
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
    }

    .beatmap-card-metadata.centered {
        align-items: center;
    }

    .beatmap-card-extra {
        width: 100%;
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .beatmap-card-extra :global(*) {
        font-size: 11px;
        font-family: "Torus Bold";
        text-transform: uppercase;
    }

    .beatmap-card-extra > :nth-child(2) {
        margin-left: auto;
    }

    .status {
        padding: 4px 6px;
        border-radius: 6px;
        background-color: var(--bg-primary);
        color: var(--text-secondary);
    }

    .title {
        max-width: 280px;
        margin: 0 0 2px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: "Torus Bold";
        font-size: 13px;
        color: #fff;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }

    .artist {
        max-width: 300px;
        margin-bottom: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: "Torus SemiBold";
        font-size: 12px;
        color: #fff;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }

    .creator {
        max-width: 320px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: "Torus SemiBold";
        font-size: 12px;
        color: var(--text-secondary, #bbb);
    }
</style>
