<script lang="ts">
    import { onDestroy } from "svelte";
    import type { IBeatmapResult, BeatmapSetResult } from "@shared/types";
    import { type Writable } from "svelte/store";
    import { type BeatmapSetComponentState, get_beatmapset_state } from "../../lib/store/beatmaps";
    import { get_beatmapset_context_options, handle_card_context_action } from "../../lib/utils/card-context-menu";
    import { get_beatmap, get_beatmapset } from "../../lib/utils/beatmaps";
    import { get_card_image_source } from "../../lib/utils/card-utils";
    import { show_context_menu, context_menu_manager } from "../../lib/store/context-menu";
    import { debounce } from "../../lib/utils/timings";
    import { get } from "svelte/store";
    import { slide } from "svelte/transition";

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
    $: visible_hashes =
        state?.beatmapset?.beatmaps && filtered_hashes.length > 0
            ? state.beatmapset.beatmaps.filter((hash) => filtered_hashes.includes(hash))
            : (state?.beatmapset?.beatmaps ?? []);

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

    const fetch_beatmaps_with_limit = async (hashes: string[], concurrency: number): Promise<IBeatmapResult[]> => {
        const results: IBeatmapResult[] = [];

        for (let i = 0; i < hashes.length; i += concurrency) {
            const batch = hashes.slice(i, i + concurrency);
            const batch_result = await Promise.all(batch.map((hash) => get_beatmap(hash)));

            for (let j = 0; j < batch_result.length; j++) {
                const beatmap = batch_result[j];

                if (beatmap != undefined) {
                    results.push(beatmap);
                }
            }
        }

        return results;
    };

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

        // preload and sort beatmaps
        if (visible_hashes.length > 0 && sorted_beatmaps.length === 0) {
            const beatmaps = await fetch_beatmaps_with_limit(visible_hashes, 8);
            sorted_beatmaps = beatmaps.sort((a, b) => (a?.star_rating || 0) - (b?.star_rating || 0));

            // set first beatmap for controls
            if (sorted_beatmaps.length > 0) {
                first_beatmap = sorted_beatmaps[0];
            }
        }

        expanded = true;
    }, 200);

    const handle_mouseleave = () => {
        debounced_hover.cancel();
        is_hovering = false;

        // ignore event if we're on the context menu
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

    // collapse if context menu closes and we are not hovering
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

            <!-- render controls -->
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

            <!-- render set information -->
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

        <!-- render difficulties when expanded -->
        {#if expanded && sorted_beatmaps.length > 0}
            <div class="beatmap-difficulties" onmouseenter={(e) => e.stopPropagation()} transition:slide={{ duration: 100 }}>
                {#each sorted_beatmaps as beatmap}
                    <BeatmapCard minimal={true} {beatmap} hash={beatmap.md5} show_control={false} />
                {/each}
            </div>
        {/if}
    </div>
{:else}
    <div style="height: {height}px; width: 100%; background: rgba(17, 20, 31, 0.35);"></div>
{/if}

<style>
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
        max-width: 100%;
    }
</style>
