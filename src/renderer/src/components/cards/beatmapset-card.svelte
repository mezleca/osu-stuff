<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import type { BeatmapSetResult, IBeatmapResult } from "@shared/types";
    import { get_beatmapset_context_options, handle_card_context_action } from "../../lib/utils/card-context-menu";
    import { get_beatmapset, get_beatmap } from "../../lib/utils/beatmaps";
    import { get_card_image_source } from "../../lib/utils/card-utils";
    import { slide } from "svelte/transition";

    // components
    import BeatmapCard from "./beatmap-card.svelte";
    import { show_context_menu, context_menu_manager } from "../../lib/store/context-menu";
    import { get } from "svelte/store";

    export let id = -1;
    export let show_context = true;
    export let show_remove = true;
    export let show_expand = true;
    export let selected = false;
    export let highlighted = false;
    export let on_remove: (id: number) => {} = null;
    export let height = 100;

    let beatmapset: BeatmapSetResult | null = null;
    let image_src: string = "";
    let image_element: HTMLImageElement = null;
    let load_timeout: NodeJS.Timeout | null = null;

    let beatmapset_loaded = false;
    let image_loaded = false;
    let visible = false;
    let visible_timeout: NodeJS.Timeout | null = null;

    // track loading state to prevent infinite loops
    let loading_id: number | null = null;
    let failed_ids = new Set<number>();

    const load_beatmapset = async () => {
        beatmapset_loaded = false;

        try {
            const result = await get_beatmapset(loading_id);

            if (result === undefined) {
                failed_ids.add(loading_id);
                beatmapset = null;
            } else {
                beatmapset = result;
                image_src = get_card_image_source(beatmapset);
            }
        } catch (err) {
            console.error("failed to load beatmapset:", loading_id, err);
            failed_ids.add(loading_id);
            beatmapset = null;
        } finally {
            beatmapset_loaded = true;
        }
    };

    const handle_context = async (e: MouseEvent) => {
        e?.preventDefault();

        if (!show_context) return;

        const options = get_beatmapset_context_options(show_remove);

        show_context_menu(e, options, (item) => {
            const item_split = item.id.split("-");
            handle_card_context_action(item_split[0], item_split[1], beatmapset, on_remove);
        });
    };

    $: {
        if (image_element) {
            // add opacity transition after image fully loads
            image_element.onload = () => (image_loaded = true);
        }

        // only load if id changed AND we haven't tried this id before
        if (visible && id > 0 && id !== loading_id && !failed_ids.has(id)) {
            loading_id = id;
            load_beatmapset();
        }
    }

    onMount(() => {
        visible_timeout = setTimeout(() => {
            visible = true;
        }, 30);
    });

    let hover_timeout: NodeJS.Timeout | null = null;
    let expanded = false;
    let sorted_beatmaps: IBeatmapResult[] = [];
    let is_hovering = false;

    const handle_mouseenter = async () => {
        is_hovering = true;

        // preload and sort beatmaps
        if (beatmapset && beatmapset.beatmaps && sorted_beatmaps.length === 0) {
            const beatmaps = await Promise.all(beatmapset.beatmaps.map((hash) => get_beatmap(hash)));
            sorted_beatmaps = beatmaps.filter((b) => b !== undefined).sort((a, b) => (a?.star_rating || 0) - (b?.star_rating || 0));
        }

        if (hover_timeout) clearTimeout(hover_timeout);
        hover_timeout = setTimeout(() => {
            expanded = true;
        }, 200);
    };

    const handle_mouseleave = () => {
        is_hovering = false;
        if (get(context_menu_manager.active)) return;

        if (hover_timeout) clearTimeout(hover_timeout);
        expanded = false;
    };

    // collapse if context menu closes and we are not hovering
    const unsubscribe_context = context_menu_manager.active.subscribe((active) => {
        if (!active && !is_hovering) {
            expanded = false;
        }
    });

    onDestroy(() => {
        unsubscribe_context();
        if (load_timeout) clearTimeout(load_timeout);
        if (visible_timeout) clearTimeout(visible_timeout);
        if (hover_timeout) clearTimeout(hover_timeout);
    });
</script>

{#if !visible || !beatmapset_loaded}
    <div style="height: {height}px; width: 100%; background: rgba(17, 20, 31, 0.65);"></div>
{:else if beatmapset}
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
        onmouseenter={handle_mouseenter}
        onmouseleave={handle_mouseleave}
    >
        <div class="beatmap-card-header" style="height: {height}px;">
            <!-- render background image -->
            <!-- svelte-ignore a11y_img_redundant_alt -->
            <img src={image_src} class="beatmap-card-background" class:loaded={image_loaded} alt="background image" bind:this={image_element} />

            <!-- render set information -->
            <div class="beatmap-card-metadata">
                <div class="title">{beatmapset.metadata?.title ?? "unknown"}</div>
                <div class="artist">by {beatmapset.metadata?.artist ?? "unknown"}</div>
                <div class="creator">mapped by {beatmapset.metadata?.creator ?? "unknown"}</div>

                {#if show_expand}
                    <div class="beatmap-card-extra">
                        {#if beatmapset.beatmaps && beatmapset.beatmaps.length > 0}
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
            <div class="beatmap-difficulties" transition:slide={{ duration: 100 }}>
                {#each sorted_beatmaps as beatmap}
                    <BeatmapCard minimal={true} {beatmap} hash={beatmap.md5} show_control={false} />
                {/each}
            </div>
        {/if}
    </div>
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
        overflow: hidden;
    }
</style>
