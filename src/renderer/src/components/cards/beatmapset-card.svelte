<script lang="ts">
    import { onDestroy } from "svelte";
    import { get_beatmapset_state } from "../../lib/store/beatmaps";
    import { get_beatmapset_context_options, handle_card_context_action } from "../../lib/utils/card-context-menu";
    import { get_beatmapset } from "../../lib/utils/beatmaps";
    import { get_card_image_source } from "../../lib/utils/card-utils";
    import {
        BEATMAPSET_DIFFICULTY_CARD_ELEMENTS,
        fetch_beatmaps_with_limit,
        get_first_beatmap,
        get_visible_hashes,
        sort_beatmaps_by_star_rating
    } from "../../lib/utils/beatmapset-card";
    import { show_context_menu, context_menu_manager } from "../../lib/store/context-menu";
    import { debounce } from "../../lib/utils/timings";
    import { get } from "svelte/store";
    import { slide } from "svelte/transition";
    import { type IBeatmapResult, type BeatmapSetResult, type BeatmapSetComponentState } from "@shared/types";
    import type { Writable } from "svelte/store";

    // components
    import BeatmapCard from "./beatmap-card.svelte";
    import BeatmapControls from "./beatmap-controls.svelte";

    export let id: number | null = null;
    export let beatmapset: BeatmapSetResult | null = null;
    export let show_context = true;
    export let show_remove = true;
    export let show_expand = true;
    export let selected = false;
    export let highlighted = false;
    export let filtered_hashes: string[] = [];
    export let on_remove: (id: number) => {} = null;
    export let height = 100;

    let state_store: Writable<BeatmapSetComponentState> | null = null;
    let expanded = false;
    let sorted_beatmaps: IBeatmapResult[] = [];
    let is_hovering = false;
    let first_beatmap: IBeatmapResult | null = null;
    let image_element: HTMLImageElement = null;
    let image_loaded = false;
    let last_filtered_hashes: string[] = filtered_hashes;

    $: state = state_store ? $state_store : null;
    $: loaded = state && state.loaded == true;
    $: visible_hashes = get_visible_hashes(state, filtered_hashes);

    const debounced_load = debounce(async () => {
        // if we're alreading loading, ignore
        if (!state || state.loading) {
            return;
        }

        state_store.update((val) => ({ ...val, loading: true }));

        try {
            // if we already have the set, just update the background
            if (state.beatmapset) {
                if (!state.background) {
                    state_store.update((s) => ({ ...s, background: get_card_image_source(s.beatmapset) }));
                }
                return;
            }

            const result = beatmapset ?? (id != null ? await get_beatmapset(id) : null);

            if (result) {
                state_store.update((s) => ({
                    ...s,
                    beatmapset: result,
                    background: !s.background ? get_card_image_source(result) : s.background
                }));
            }
        } catch (err) {
            console.error("failed to load beatmapset:", id, err);
            state_store.update((s) => ({ ...s, beatmapset: null }));
        } finally {
            state_store.update((s) => ({ ...s, loading: false, loaded: true }));
        }
    }, 50);

    const handle_context = async (e: MouseEvent) => {
        e?.preventDefault();

        if (!show_context) {
            return;
        }

        const current_set = state.beatmapset;

        if (!current_set) {
            return;
        }

        const options = get_beatmapset_context_options(show_remove);

        show_context_menu(e, options, (item) => {
            const item_split = item.id.split("-");
            handle_card_context_action(item_split[0], item_split[1], current_set, on_remove, null, visible_hashes);
        });
    };

    const debounced_hover = debounce(async () => {
        is_hovering = true;

        if (visible_hashes.length > 0 && sorted_beatmaps.length === 0) {
            const beatmaps = await fetch_beatmaps_with_limit(visible_hashes, 8);
            sorted_beatmaps = sort_beatmaps_by_star_rating(beatmaps);
            first_beatmap = get_first_beatmap(sorted_beatmaps);
        }

        expanded = true;
    }, 200);

    const handle_mouseleave = () => {
        debounced_hover.cancel();
        is_hovering = false;

        if (get(context_menu_manager.active)) {
            return;
        }

        expanded = false;
    };

    const mark_beatmap_as_downloaded = (checksum: string) => {
        if (!checksum) {
            return;
        }

        const index = sorted_beatmaps.findIndex((beatmap) => beatmap.md5 == checksum);

        if (index == -1) {
            return;
        }

        const updated = { ...sorted_beatmaps[index], temp: false };
        const next = [...sorted_beatmaps];
        next[index] = updated;
        sorted_beatmaps = next;

        if (first_beatmap?.md5 == checksum) {
            first_beatmap = updated;
        }
    };

    const unsubscribe_context = context_menu_manager.active.subscribe((active) => {
        if (!active && !is_hovering) {
            handle_mouseleave();
        }
    });

    $: {
        if (id != null && Number.isFinite(id)) {
            state_store = get_beatmapset_state(id);
            expanded = false;
            sorted_beatmaps = [];
            first_beatmap = null;
            image_loaded = false;
            debounced_load();
        }

        if (image_element) {
            image_element.onload = () => (image_loaded = true);
        }
    }

    $: {
        if (filtered_hashes !== last_filtered_hashes) {
            last_filtered_hashes = filtered_hashes;
            sorted_beatmaps = [];
            first_beatmap = null;
            expanded = false;
        }
    }

    onDestroy(() => {
        debounced_load.cancel();
        debounced_hover.cancel();
        unsubscribe_context();

        if (image_element) {
            image_element.src = "";
        }
    });
</script>

{#if !loaded}
    <div style="height: {height}px; width: 100%; background: rgba(17, 20, 31, 0.65);"></div>
{:else if state.beatmapset}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="beatmap-card"
        style="min-height: {height}px;"
        class:selected
        class:expanded
        class:highlighted
        class:loaded={image_loaded}
        oncontextmenu={handle_context}
        onmouseenter={debounced_hover}
        onmouseleave={handle_mouseleave}
    >
        <div class="beatmap-card-header" style="height: {height}px;">
            <!-- render background image -->
            <!-- svelte-ignore a11y_img_redundant_alt -->
            <img
                src={state.background}
                class="beatmap-card-background"
                class:loaded={image_loaded}
                alt=""
                loading="lazy"
                decoding="async"
                bind:this={image_element}
            />

            {#if first_beatmap}
                <BeatmapControls
                    beatmapset_id={state.beatmapset.online_id}
                    hash={first_beatmap.md5}
                    has_map={!first_beatmap.temp}
                    {show_remove}
                    on_download={mark_beatmap_as_downloaded}
                    on_remove={() => {
                        if (on_remove) on_remove(state.beatmapset.online_id);
                    }}
                />
            {/if}

            <div class="beatmap-card-metadata">
                <div class="title">{state.beatmapset.metadata?.title ?? "unknown"}</div>
                <div class="artist">by {state.beatmapset.metadata?.artist ?? "unknown"}</div>
                <div class="creator">mapped by {state.beatmapset.metadata?.creator ?? "unknown"}</div>

                {#if show_expand}
                    <div class="beatmap-card-extra">
                        {#if visible_hashes.length > 0}
                            <div class="expand-indicator">
                                {expanded ? "▼" : "▶"}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>

        {#if expanded && sorted_beatmaps.length > 0}
            <div class="beatmap-difficulties" onmouseenter={(e) => e.stopPropagation()} transition:slide={{ duration: 100 }}>
                {#each sorted_beatmaps as beatmap}
                    <BeatmapCard mode="minimal" {beatmap} hash={beatmap.md5} elements={BEATMAPSET_DIFFICULTY_CARD_ELEMENTS} />
                {/each}
            </div>
        {/if}
    </div>
{:else}
    <div style="height: {height}px; width: 100%; background: rgba(17, 20, 31, 0.35);"></div>
{/if}

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

    .beatmap-card.selected,
    .beatmap-card.expanded {
        border-color: var(--accent-color);
    }

    .beatmap-card.highlighted {
        border-color: var(--accent-hover);
    }

    .expand-indicator {
        position: absolute;
        bottom: 0;
        right: 0;
        padding: 4px 8px;
        user-select: none;
        opacity: 0.5;
    }

    .beatmap-card-header {
        position: relative;
        width: 100%;
        max-width: 100%;
        overflow: hidden;
    }

    .beatmap-card-header > .beatmap-card-background {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: 100%;
        min-height: 100px;
        object-fit: cover;
        object-position: center;
        display: block;
        z-index: 1;
        filter: brightness(0.5);
        transition: opacity 0.2s ease-in-out;
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

    .beatmap-card-extra {
        width: 100%;
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
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

    .beatmap-difficulties {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        row-gap: 5px;
        width: 100%;
        min-width: 0;
        overflow: hidden;
        padding: 8px;
        border: none;
        background: rgba(17, 20, 31);
        z-index: 999;
    }

    .beatmap-card :global(.card-control) {
        position: absolute;
        top: 10px;
        right: 10px;
    }

    .beatmap-card :global(.control-btn) {
        opacity: 0;
    }

    .beatmap-card:hover :global(.control-btn),
    .beatmap-card.expanded :global(.control-btn) {
        opacity: 1;
    }
</style>
