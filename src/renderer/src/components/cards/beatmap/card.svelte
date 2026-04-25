<script lang="ts">
    import type { BeatmapCardCallbacks, BeatmapCardViewState } from "@shared/types";
    import { get_status_style } from "../../../lib/utils/card-utils";

    import BeatmapControls from "../beatmap-controls.svelte";

    export let view_state: BeatmapCardViewState;
    export let callbacks: BeatmapCardCallbacks;
    export let image_element: HTMLImageElement | null = null;

    $: status_style = get_status_style(view_state.beatmap?.status);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="beatmap-card"
    style={`height: ${view_state.height}px;`}
    class:selected={view_state.selected}
    class:highlighted={view_state.highlighted}
    class:temp={view_state.beatmap?.temp}
    class:loaded={view_state.image_loaded}
    onclick={callbacks.on_click}
    oncontextmenu={callbacks.on_contextmenu}
>
    <img
        class="beatmap-card-background"
        class:loaded={view_state.image_loaded}
        src={view_state.background}
        alt=""
        loading="lazy"
        decoding="async"
        bind:this={image_element}
    />

    {#if view_state.show_extra_actions}
        <BeatmapControls
            beatmapset_id={view_state.beatmap?.beatmapset_id ?? -1}
            show_remove={view_state.show_action_remove}
            hash={view_state.hash}
            has_map={view_state.has_map}
            on_remove={callbacks.on_remove}
            on_download={callbacks.on_download}
        />
    {/if}

    <div class="beatmap-card-metadata" class:centered={view_state.centered}>
        <div class="title">{view_state.beatmap?.title ?? "unknown"}</div>
        <div class="artist">by {view_state.beatmap?.artist ?? "unknown"}</div>
        <div class="creator">mapped by {view_state.beatmap?.creator ?? "unknown"}</div>
        {#if view_state.show_status}
            <div class="beatmap-card-extra">
                <span class="status" style={`background-color: ${status_style.background}; color: ${status_style.text};`}>
                    {view_state.beatmap?.status ?? "unknown"}
                </span>
                {#if view_state.show_bpm}
                    <span class="bpm">{Math.round(view_state.beatmap?.bpm ?? 0)} bpm</span>
                {/if}
                {#if view_state.show_star_rating}
                    <span class="star-rating">★ {view_state.formatted_star_rating}</span>
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

    .beatmap-card-background {
        position: absolute;
        width: 100%;
        height: 100%;
        min-height: 100px;
        object-fit: cover;
        object-position: center;
        display: block;
        z-index: 1;
        filter: brightness(0.5);
        transition: opacity 0.2s ease-in-out;
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
        font-size: 12px;
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
