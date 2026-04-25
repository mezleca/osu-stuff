<script lang="ts">
    import type { BeatmapCardCallbacks, BeatmapCardViewState } from "@shared/types";
    import { format_time } from "../../../lib/utils/utils";

    import BeatmapControls from "../beatmap-controls.svelte";

    export let view_state: BeatmapCardViewState;
    export let callbacks: BeatmapCardCallbacks;
    export let image_element: HTMLImageElement | null = null;

    const format_bpm = (value: number): number => {
        return Math.floor(value) ?? 0;
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="radio-card"
    class:selected={view_state.selected}
    class:highlighted={view_state.highlighted}
    onclick={callbacks.on_click}
    oncontextmenu={callbacks.on_contextmenu}
>
    <div class="radio-card-content">
        {#if view_state.show_extra_actions}
            <div class="card-actions">
                <BeatmapControls
                    beatmapset_id={view_state.beatmap?.beatmapset_id ?? -1}
                    show_remove={view_state.show_action_remove}
                    hash={view_state.hash}
                    has_map={view_state.has_map}
                    on_remove={callbacks.on_remove}
                />
            </div>
        {/if}

        <div class="cover-frame">
            <img
                class="cover-image"
                class:loaded={view_state.image_loaded}
                src={view_state.background}
                alt=""
                loading="lazy"
                decoding="async"
                bind:this={image_element}
            />
        </div>

        <div class="metadata">
            <span class="title">{view_state.beatmap?.title ?? "unknown"}</span>
            <span class="artist">{view_state.beatmap?.artist ?? "unknown"}</span>
        </div>

        <div class="extra">
            <span class="extra-value bpm">{format_bpm(view_state.beatmap?.bpm ?? 0)} BPM</span>
            <span class="extra-value duration">{format_time(view_state.beatmap?.duration ?? 0)}</span>
        </div>
    </div>
</div>

<style>
    .radio-card {
        display: flex;
        border: 2px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        transition:
            border-color 0.15s ease,
            background-color 0.15s ease;
        background: rgba(16, 16, 16, 0.72);
    }

    .radio-card:hover {
        background: rgba(255, 255, 255, 0.04);
    }

    .radio-card.selected {
        border-color: var(--accent-color);
        background: rgba(255, 255, 255, 0.05);
    }

    .radio-card.highlighted {
        border-color: var(--accent-hover);
    }

    .radio-card-content {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
    }

    .card-actions {
        flex-shrink: 0;
    }

    .card-actions :global(.control-btn) {
        opacity: 1;
    }

    .cover-frame {
        width: 50px;
        height: 50px;
        overflow: hidden;
        flex-shrink: 0;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.06);
    }

    .cover-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        display: block;
    }

    .metadata {
        min-width: 0;
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 2px;
    }

    .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: "Torus SemiBold";
        font-size: 14px;
        color: var(--text-color);
    }

    .artist,
    .extra > span {
        font-family: "Torus SemiBold";
        font-size: 13px;
        color: var(--text-secondary);
    }

    .artist {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .extra {
        display: grid;
        grid-template-columns: 72px 52px;
        flex-shrink: 0;
        gap: 12px;
        align-items: center;
        justify-items: end;
    }

    .extra-value {
        text-align: right;
        white-space: nowrap;
    }
</style>
