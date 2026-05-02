<script lang="ts">
    import { format_time } from "../../../lib/utils/utils";
    import type { BeatmapCardFlags } from "../../../lib/utils/beatmap-card";
    import type { IBeatmapResult } from "@shared/types";

    import BeatmapControls from "../beatmap-controls.svelte";

    export let beatmap: IBeatmapResult | null = null;
    export let flags: BeatmapCardFlags;
    export let selected = false;
    export let highlighted = false;
    export let image_loaded = false;
    export let background = "";
    export let hash = "";
    export let has_map = false;
    export let image_element: HTMLImageElement | null = null;
    export let on_click: (event: MouseEvent) => void = null;
    export let on_contextmenu: (event: MouseEvent) => void = null;
    export let on_remove: (checksum: string) => void = null;

    const format_bpm = (value: number): number => Math.floor(value) ?? 0;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="radio-card" class:selected class:highlighted onclick={on_click} oncontextmenu={on_contextmenu}>
    <div class="radio-card-content">
        {#if flags.show_extra_actions}
            <div class="card-actions">
                <BeatmapControls beatmapset_id={beatmap?.beatmapset_id ?? -1} show_remove={flags.show_action_remove} {hash} {has_map} {on_remove} />
            </div>
        {/if}

        <div class="cover-frame">
            <img class="cover-image" class:loaded={image_loaded} src={background} alt="" loading="lazy" decoding="async" bind:this={image_element} />
        </div>

        <div class="metadata">
            <span class="title">{beatmap?.title ?? "unknown"}</span>
            <span class="artist">{beatmap?.artist ?? "unknown"}</span>
        </div>

        <div class="extra">
            <span class="extra-value bpm">{format_bpm(beatmap?.bpm ?? 0)} BPM</span>
            <span class="extra-value duration">{format_time(beatmap?.duration ?? 0)}</span>
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
