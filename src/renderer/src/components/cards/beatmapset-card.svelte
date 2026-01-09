<script lang="ts">
    import { onDestroy } from "svelte";
    import type { BeatmapSetResult, IBeatmapResult } from "@shared/types";
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

    export let id = -1;
    export let show_context = true;
    export let show_remove = true;
    export let show_expand = true;
    export let selected = false;
    export let highlighted = false;
    export let on_remove: (id: number) => {} = null;
    export let height = 100;

    let state: BeatmapSetComponentState | null = null;

    let expanded = false;
    let sorted_beatmaps: IBeatmapResult[] = [];
    let is_hovering = false;
    let first_beatmap: IBeatmapResult | null = null;
    let image_element: HTMLImageElement = null;
    let image_loaded = false;

    $: loaded = state && state.loaded == true;

    const debounced_load = debounce(async () => {
        // if we're alreading loading, ignore
        if (!state || state.loading) {
            return;
        }

        state.loading = true;

        try {
            // if we already have the set, fuck ignore
            if (state.beatmapset) {
                if (!state.background) {
                    state.background = get_card_image_source(state.beatmapset);
                }
                return;
            }

            let result: BeatmapSetResult | null = null;

            // try to get beatmapset from list manager
            if (!result) {
                result = await get_beatmapset(id);
            }

            // if we found, update the card state
            if (result != undefined) {
                state.beatmapset = result;

                if (!state.background) {
                    state.background = get_card_image_source(state.beatmapset);
                }
            }
        } catch (err) {
            console.error("failed to load beatmapset:", id, err);
            state.beatmapset = null;
        } finally {
            state.loading = false;
            state.loaded = true;
        }
    }, 50);

    const handle_context = async (e: MouseEvent) => {
        e?.preventDefault();

        if (!show_context) {
            return;
        }

        const options = get_beatmapset_context_options(show_remove);

        show_context_menu(e, options, (item) => {
            const item_split = item.id.split("-");
            handle_card_context_action(item_split[0], item_split[1], state.beatmapset, on_remove);
        });
    };

    const debounced_hover = debounce(async () => {
        is_hovering = true;

        // preload and sort beatmaps
        if (state.beatmapset && state.beatmapset.beatmaps && sorted_beatmaps.length === 0) {
            const beatmaps = await Promise.all(state.beatmapset.beatmaps.map((hash) => get_beatmap(hash)));
            sorted_beatmaps = beatmaps.filter((b) => b !== undefined).sort((a, b) => (a?.star_rating || 0) - (b?.star_rating || 0));

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

    // collapse if context menu closes and we are not hovering
    const unsubscribe_context = context_menu_manager.active.subscribe((active) => {
        if (!active && !is_hovering) {
            handle_mouseleave();
        }
    });

    $: {
        if (!state && id > 0) {
            state = get_beatmapset_state(id);
        }

        if (image_element) {
            image_element.onload = () => (image_loaded = true);
        }

        // load beatmapset if we're not loaded yet
        if (state && !state.loaded) {
            debounced_load();
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
                alt="background image"
                bind:this={image_element}
            />

            <!-- render controls -->
            {#if first_beatmap}
                <BeatmapControls
                    beatmapset_id={state.beatmapset.online_id}
                    hash={first_beatmap.md5}
                    has_map={!first_beatmap.temp}
                    {show_remove}
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
                        {#if state.beatmapset.beatmaps && state.beatmapset.beatmaps.length > 0}
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
