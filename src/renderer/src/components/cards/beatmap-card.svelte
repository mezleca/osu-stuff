<script lang="ts">
    import { onDestroy } from "svelte";
    import type { Writable } from "svelte/store";
    import {
        BEATMAP_CARD_ELEMENT,
        type BeatmapCardElements,
        type BeatmapCardMode,
        type BeatmapComponentState,
        type IBeatmapResult
    } from "@shared/types";

    import { get_beatmap_state } from "../../lib/store/beatmaps";
    import { show_context_menu } from "../../lib/store/context-menu";
    import { debounce } from "@shared/timing";
    import { get_beatmap_card_flags, get_display_beatmap } from "../../lib/utils/beatmap-card";
    import { get_placeholder_image, get_card_image_source } from "../../lib/utils/card-utils";
    import { get_beatmap } from "../../lib/utils/beatmaps";
    import { get_beatmap_context_options, handle_card_context_action } from "../../lib/utils/card-context-menu";

    import CardBeatmapCard from "./beatmap/card.svelte";
    import MinimalBeatmapCard from "./beatmap/minimal.svelte";
    import RadioBeatmapCard from "./beatmap/radio.svelte";

    export let selected = false;
    export let highlighted = false;
    export let beatmap: IBeatmapResult | null = null;
    export let elements: BeatmapCardElements = BEATMAP_CARD_ELEMENT.EXTRA_ACTIONS;
    export let mode: BeatmapCardMode = "card";
    export let hash = "";
    export let centered = false;
    export let height = 100;
    export let on_click: (event: MouseEvent) => void = null;
    export let on_remove: (checksum: string) => void = null;
    export let on_remove_set: (id: number) => void = null;

    let state_store: Writable<BeatmapComponentState> | null = null;
    let image_element: HTMLImageElement | null = null;
    let image_loaded = false;
    let state: BeatmapComponentState | null = null;
    let last_hash = "";

    $: state = state_store ? $state_store : null;
    $: loaded = mode == "minimal" && !!beatmap ? true : state?.loaded == true;
    $: display_beatmap = get_display_beatmap(mode, beatmap, state);
    $: flags = get_beatmap_card_flags(elements);
    $: background = state?.background ?? "";
    $: has_map = !!state?.beatmap && state.beatmap.temp == false;

    const debounced_load = debounce(async () => {
        if (!state || state.loading) {
            return;
        }

        state_store.update((value) => ({ ...value, loading: true }));

        try {
            if (state.beatmap) {
                if (mode != "minimal" && state.background == "") {
                    state_store.update((current_state) => ({
                        ...current_state,
                        background: get_card_image_source(current_state.beatmap)
                    }));
                }

                return;
            }

            let result: IBeatmapResult | null = null;

            if (beatmap && !state.beatmap) {
                result = beatmap;
            }

            if (!result) {
                result = await get_beatmap(hash);
            }

            if (!result) {
                state_store.update((current_state) => ({ ...current_state, beatmap: null }));
                return;
            }

            state_store.update((current_state) => ({
                ...current_state,
                beatmap: result,
                background: mode != "minimal" && current_state.background == "" ? get_card_image_source(result) : current_state.background
            }));
        } catch (error) {
            console.error("failed to load beatmap:", error);
            state_store.update((current_state) => ({ ...current_state, beatmap: null }));
        } finally {
            state_store.update((current_state) => ({ ...current_state, loading: false, loaded: true }));
        }
    }, 50);

    const handle_click = (event: MouseEvent) => {
        event.stopPropagation();

        if (!display_beatmap || !on_click) {
            return;
        }

        on_click(event);
    };

    const handle_context = (event: MouseEvent) => {
        event.stopPropagation();

        if (!flags.show_context_menu || !display_beatmap) {
            return;
        }

        const options = get_beatmap_context_options(display_beatmap, flags.show_context_remove);

        show_context_menu(event, options, (item) => {
            const item_split = item.id.split("-");
            handle_card_context_action(item_split[0], item_split[1], display_beatmap, on_remove, on_remove_set);
        });
    };

    const handle_download = () => {
        if (!state_store) {
            return;
        }

        state_store.update((current_state) => ({
            ...current_state,
            beatmap: current_state.beatmap ? { ...current_state.beatmap, temp: false } : current_state.beatmap
        }));
    };

    $: {
        if (hash) {
            if (hash != last_hash) {
                last_hash = hash;
                image_loaded = false;
            }

            state_store = get_beatmap_state(hash);
            debounced_load();
        }

        if (image_element) {
            image_element.onload = () => {
                image_loaded = true;
            };

            image_element.onerror = () => {
                if (!image_element) {
                    return;
                }

                image_element.src = get_placeholder_image();
            };
        }
    }

    onDestroy(() => {
        debounced_load.cancel();

        if (image_element) {
            image_element.src = "";
        }
    });
</script>

{#if mode == "minimal" && display_beatmap}
    <MinimalBeatmapCard beatmap={display_beatmap} on_contextmenu={handle_context} />
{:else if !loaded}
    <div style={`height: ${height}px; width: 100%; background: rgba(17, 20, 31, 0.65);`}></div>
{:else if mode == "radio"}
    <RadioBeatmapCard
        bind:image_element
        beatmap={display_beatmap}
        on_click={handle_click}
        on_contextmenu={handle_context}
        {flags}
        {selected}
        {highlighted}
        {image_loaded}
        {background}
        {hash}
        {has_map}
        {on_remove}
    />
{:else}
    <CardBeatmapCard
        bind:image_element
        beatmap={display_beatmap}
        on_click={handle_click}
        on_contextmenu={handle_context}
        on_download={handle_download}
        {flags}
        {selected}
        {highlighted}
        {centered}
        {height}
        {image_loaded}
        {background}
        {hash}
        {has_map}
        {on_remove}
    />
{/if}
