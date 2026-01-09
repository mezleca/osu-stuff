<script lang="ts">
    import { onDestroy } from "svelte";
    import { get_beatmap } from "../../lib/utils/beatmaps";
    import { get_card_image_source } from "../../lib/utils/card-utils";
    import { open_on_browser } from "../../lib/utils/utils";
    import { debounce } from "../../lib/utils/timings";
    import { show_context_menu } from "../../lib/store/context-menu";
    import { get_beatmap_context_options, handle_card_context_action } from "../../lib/utils/card-context-menu";
    import { type BeatmapComponentState, get_beatmap_state } from "../../lib/store/beatmaps";
    import { type IBeatmapResult } from "@shared/types";

    // components
    import BeatmapControls from "./beatmap-controls.svelte";

    export let selected = false,
        highlighted = false,
        beatmap: IBeatmapResult | null = null,
        hash: string = "",
        show_bpm = true,
        show_star_rating = true,
        show_status = true,
        show_remove = true,
        show_context = true,
        show_control = true,
        centered = false,
        minimal = false,
        height = 100,
        on_click: (event: MouseEvent) => void = null,
        on_remove: (checksum: string) => void = null;

    let state: BeatmapComponentState | null = null;

    let image_element: HTMLImageElement = null;
    let image_loaded = false;

    $: loaded = state && state.loaded == true;
    $: has_map = state?.beatmap && state.beatmap.temp == false;

    const debounced_load = debounce(async () => {
        // if we're alreading loading, ignore
        if (!state || state.loading) {
            return;
        }

        state.loading = true;

        try {
            // ignore if we already have the beatmap saved
            if (state.beatmap) {
                return;
            }

            let result: IBeatmapResult | null = null;

            // use the manually passed beatmap if possible
            if (beatmap && !state.beatmap) {
                result = beatmap;
            }

            // otherwise, get using ipc / cache
            if (!result) {
                result = await get_beatmap(hash);
            }

            if (result != undefined) {
                state.beatmap = result;

                if (!minimal && state.background == "") {
                    state.background = get_card_image_source(state.beatmap);
                }
            }
        } catch (err) {
            console.error("failed to load beatmap:", err);
            state.beatmap = null;
        } finally {
            state.loading = false;
            state.loaded = true;
        }
    }, 50);

    const handle_click = (event: MouseEvent) => {
        event.stopPropagation();
        if (beatmap && on_click) on_click(event);
    };

    const handle_context = async (event: MouseEvent) => {
        event.stopPropagation();

        if (!show_context) return;

        const options = get_beatmap_context_options(beatmap, show_remove);

        show_context_menu(event, options, (item) => {
            const item_split = item.id.split("-");
            handle_card_context_action(item_split[0], item_split[1], beatmap, on_remove);
        });
    };

    const get_beatmap_star_rating = (beatmap: IBeatmapResult): string => {
        if (beatmap?.star_rating) {
            return beatmap.star_rating.toFixed(2);
        }

        return "0.0";
    };

    $: {
        if (!state && hash) {
            state = get_beatmap_state(hash);
        }

        if (image_element) {
            image_element.onload = () => (image_loaded = true);
        }

        // load beatmap if we're not loaded yet
        if (state && !state.loaded) {
            debounced_load();
        }
    }

    onDestroy(() => {
        debounced_load.cancel();
    });
</script>

{#if minimal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <span
        role="button"
        tabindex="0"
        onclick={(e) => {
            e.stopPropagation();
            open_on_browser(beatmap?.beatmapset_id);
        }}
        oncontextmenu={handle_context}
        class="star-rating"
    >
        ★ {get_beatmap_star_rating(beatmap)}</span
    >
    <p>{beatmap?.difficulty ?? "unknown"}</p>
{:else if !loaded}
    <div style="height: {height}px; width: 100%; background: rgba(17, 20, 31, 0.65);"></div>
{:else}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="beatmap-card"
        style="height: {height}px;"
        class:selected
        class:highlighted
        class:temp={beatmap?.temp}
        class:loaded={image_loaded}
        onclick={(event) => handle_click(event)}
        oncontextmenu={handle_context}
    >
        <!-- render background image -->
        <!-- svelte-ignore a11y_img_redundant_alt -->
        <img src={state.background} class="beatmap-card-background" class:loaded={image_loaded} alt="background image" bind:this={image_element} />

        <!-- render controls -->
        {#if show_control}
            <BeatmapControls beatmapset_id={state.beatmap?.beatmapset_id ?? -1} {hash} {has_map} {show_remove} {on_remove} />
        {/if}

        <!-- render set information -->
        <div class="beatmap-card-metadata" class:centered>
            <div class="title">{state.beatmap?.title ?? "unknown"}</div>
            <div class="artist">by {state.beatmap?.artist ?? "unknown"}</div>
            <div class="creator">mapped by {state.beatmap?.creator ?? "unknown"}</div>
            {#if show_status}
                <div class="beatmap-card-extra">
                    <span class="status">{state.beatmap?.status ?? "unknown"}</span>
                    {#if show_bpm}
                        <span class="bpm">{Math.round(state.beatmap?.bpm) ?? "0"} bpm</span>
                    {/if}
                    {#if show_star_rating}
                        <span class="star-rating">★ {get_beatmap_star_rating(state.beatmap)}</span>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .beatmap-card.temp {
        border: 2px solid red;
    }
</style>
