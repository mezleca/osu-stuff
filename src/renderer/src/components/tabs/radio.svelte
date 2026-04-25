<script lang="ts">
    import { onMount, tick } from "svelte";

    import type { AudioDirection, BeatmapListRef, BeatmapUpdateReason, IBeatmapResult, ISelectedBeatmap } from "@shared/types";
    import { collections } from "../../lib/store/collections";
    import { FILTER_DATA, SEARCH_DEBOUNCE_INTERVAL } from "../../lib/store/other";
    import { ALL_BEATMAPS_KEY, BEATMAP_CARD_ELEMENT } from "@shared/types";
    import { debounce } from "@shared/timing";
    import { get_radio_background_image, get_radio_card_elements, get_radio_collection_options, push_previous_if_new } from "../../lib/utils/radio";
    import { get_audio_manager } from "../../lib/store/audio";
    import { get_beatmap_list } from "../../lib/store/beatmaps";
    import { get_beatmap, remove_beatmap_from_collection, remove_beatmapset_from_collection } from "../../lib/utils/beatmaps";
    import { input } from "../../lib/store/input";
    import { config } from "../../lib/store/config";

    // components
    import Search from "../utils/basic/search.svelte";
    import RadioTimeline from "./radio/timeline.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import BeatmapList from "../beatmap-list.svelte";

    // @ts-ignore
    import FALLBACK_IMAGE from "@assets/images/fallback.png";

    const list = get_beatmap_list("radio");
    const audio = get_audio_manager("radio");
    const selected_store = collections.get_selected_store("radio");
    const collection_should_update = collections.needs_update;

    const { selected_buffer, previous_buffer, query, sort, should_update, update_reason } = list;

    let selected_beatmap: IBeatmapResult | null = null;
    let beatmap_list_ref: BeatmapListRef | null = null;
    let selected: ISelectedBeatmap | null = null;
    let selected_collection = ALL_BEATMAPS_KEY;
    let bg = "";
    let card_elements = BEATMAP_CARD_ELEMENT.CONTEXT_MENU | BEATMAP_CARD_ELEMENT.EXTRA_ACTIONS;
    let total_beatmaps = 0;
    let syncing_selected_id = "";

    $: selected = $selected_buffer[0];
    $: selected_collection = $selected_store.name || ALL_BEATMAPS_KEY;
    $: card_elements = get_radio_card_elements(selected_collection);
    $: if (selected_collection) {
        list.set_target(selected_collection);
    }

    $: collection_target_options = get_radio_collection_options(collections.get_all());
    $: bg = get_radio_background_image(selected_beatmap, $config.radio_background);

    const debounced_update = debounce(async (force: boolean = false, reason: BeatmapUpdateReason = "unknown") => {
        list.set_target(selected_collection);

        const result = await list.search(force);

        if (!result) {
            return;
        }

        const beatmaps = result.beatmaps.map((b) => b.md5);
        list.set_items(beatmaps);
        update_total_beatmaps();

        if (selected?.id) {
            const selected_idx = beatmaps.indexOf(selected.id as string);

            if (selected_idx != -1 && selected.index != selected_idx) {
                list.select({ id: selected.id, index: selected_idx });
            }
        }

        if ($query == "" && reason != "remove") {
            await tick();
            beatmap_list_ref?.focus_selected(true);
        }
    }, SEARCH_DEBOUNCE_INTERVAL);

    type NavigateOptions = {
        force_random?: boolean;
    };

    const retry_random = debounce(() => navigate_random(false), 150);
    const trigger_random = debounce(() => navigate_random(true), 50);

    const SEEK_OFFSET_SECONDS = 5;

    const navigate_random = async (allow_retry: boolean = true) => {
        const state = audio.get_state();

        if (state.audio && state.audio.currentTime > 0.1 && state.playing) {
            audio.pause();
        }

        const navigated = await audio.navigate(0, { force_random: true });

        if (!navigated && allow_retry) {
            retry_random();
        }
    };

    const seek_by_seconds = (offset_seconds: number) => {
        const state = audio.get_state();
        const current_audio = state.audio;

        if (!current_audio || !isFinite(current_audio.duration)) {
            return;
        }

        const next_time = Math.max(0, Math.min(current_audio.duration, current_audio.currentTime + offset_seconds));
        const seek_percent = current_audio.duration > 0 ? next_time / current_audio.duration : 0;

        audio.seek(seek_percent);
    };

    const pick_next_valid_id = async (direction: AudioDirection, options: NavigateOptions = {}) => {
        const beatmaps = list.get_items();

        if (beatmaps.length == 0) {
            return null;
        }

        const tried = new Set<number>();

        let attempts = 0;
        let current_index = selected?.index ?? 0;

        while (attempts < beatmaps.length) {
            const next_idx = audio.calculate_next_index(current_index, beatmaps.length, direction, options);

            if (tried.has(next_idx)) {
                attempts++;
                current_index = next_idx;
                continue;
            }

            tried.add(next_idx);

            const beatmap_id = beatmaps[next_idx];
            const beatmap = await get_beatmap(beatmap_id);

            if (!beatmap?.audio) {
                console.log("[radio] skipping invalid beatmap:", beatmap_id);
                attempts++;
                current_index = next_idx;
                continue;
            }

            return { beatmap_id, index: next_idx };
        }

        return null;
    };

    const push_to_previous_if_new = (beatmap: ISelectedBeatmap) => {
        list.previous_buffer.update((old) => push_previous_if_new(old, beatmap));
    };

    const focus_selected_in_list = async () => {
        await tick();
        beatmap_list_ref?.focus_selected(true);
    };

    const update_total_beatmaps = () => {
        total_beatmaps = beatmap_list_ref?.get_total?.() ?? 0;
    };

    const set_selected_beatmap = (beatmap: ISelectedBeatmap) => {
        if (!selected || beatmap.id != selected.id) {
            list.select(beatmap);
        }
    };

    const get_next_id_callback = async (direction: AudioDirection, options: NavigateOptions = {}) => {
        const result = await pick_next_valid_id(direction, options);

        if (!result) {
            return null;
        }

        set_selected_beatmap({ id: result.beatmap_id, index: result.index });

        if (options.force_random) {
            await focus_selected_in_list();
        }

        return result.beatmap_id;
    };

    const get_beatmap_callback = async (beatmap_id: string) => {
        return await get_beatmap(beatmap_id);
    };

    const remove_callback = async (hash: string) => {
        await remove_beatmap_from_collection(hash, selected_collection);

        const current_items = list.get_items();
        const new_items = current_items.filter((h) => h != hash);

        list.set_items(new_items);
        update_total_beatmaps();
        collections.filter();
    };

    const remove_set_callback = async (id: number) => {
        const hashes = await remove_beatmapset_from_collection(id, selected_collection);
        const current_items = list.get_items();
        const new_items = current_items.filter((md5) => !hashes.includes(md5));

        list.set_items(new_items);
        update_total_beatmaps();
        collections.filter();
    };

    const sync_selected_beatmap = async () => {
        const selected_id = selected?.id as string | undefined;

        if (!selected_id || syncing_selected_id == selected_id) {
            return;
        }

        syncing_selected_id = selected_id;

        try {
            const result = await get_beatmap(selected_id);

            if (!result) {
                console.error("failed to load beatmap:", selected);
                return;
            }

            if (selected?.id != selected_id) {
                return;
            }

            selected_beatmap = result;

            if (audio.get_state().id == selected_id) {
                return;
            }

            push_to_previous_if_new(selected);

            const audio_result = await audio.load_and_setup_audio(selected_id);

            if (!audio_result) {
                clear_loaded_beatmap();
                console.error("failed to load audio...");
                return;
            }

            if (selected?.id != selected_id) {
                return;
            }

            await audio.play();
        } finally {
            if (syncing_selected_id == selected_id) {
                syncing_selected_id = "";
            }
        }
    };

    const clear_loaded_beatmap = () => {
        selected_beatmap = null;
        syncing_selected_id = "";
        audio.clean_audio();
    };

    $: {
        if (selected && selected?.index != -1) {
            sync_selected_beatmap();
        } else if (!selected || selected?.id == -1) {
            clear_loaded_beatmap();
        }

        if (selected_collection && $selected_store.name != selected_collection) {
            if (selected_collection != ALL_BEATMAPS_KEY && !collections.has(selected_collection)) {
                selected_collection = ALL_BEATMAPS_KEY;
            }

            list.set_target(selected_collection);
            collections.select(selected_collection, "radio");
        }

        if ($should_update) {
            debounced_update($should_update, $update_reason);
        }
    }

    onMount(() => {
        list.show_unique.set(true);
        list.has_duration.set(true);

        audio.set_callbacks({
            get_next_id: get_next_id_callback,
            get_beatmap: get_beatmap_callback
        });

        if (selected?.index == -1) {
            audio.clean_audio();
        }

        const handle_random_id = input.on("f2", () => {
            trigger_random();
        });

        const handle_previous_id = input.on("shift+f2", async () => {
            const index = $previous_buffer.length - 2;
            const data = $previous_buffer[index];

            if (!data) {
                return;
            }

            list.select(data);
            list.previous_buffer.update((old) => (old.length > 0 ? old.slice(0, -1) : old));
            await focus_selected_in_list();
        });

        const handle_seek_backward_id = input.on("shift+arrowleft", () => {
            seek_by_seconds(-SEEK_OFFSET_SECONDS);
        });

        const handle_seek_forward_id = input.on("shift+arrowright", () => {
            seek_by_seconds(SEEK_OFFSET_SECONDS);
        });

        tick().then(() => {
            beatmap_list_ref?.focus_selected(true);
            update_total_beatmaps();
        });

        return () => {
            debounced_update.cancel();

            input.unregister(handle_random_id);
            input.unregister(handle_previous_id);
            input.unregister(handle_seek_backward_id);
            input.unregister(handle_seek_forward_id);
        };
    });
</script>

<div class="content tab-content">
    <div
        class="radio-container"
        style:background-image={`linear-gradient(180deg, rgba(24, 16, 18, 0.96), rgba(14, 14, 14, 0.98)), url(${bg || FALLBACK_IMAGE})`}
    >
        <div class="radio-header">
            <div class="search-slot">
                <Search bind:value={$query} placeholder="search beatmaps" />
            </div>

            <div class="filter-row">
                <div class="results-count-inline">{total_beatmaps} beatmaps</div>

                <Dropdown inline={true} label={"sort"} bind:selected_value={$sort} options={FILTER_DATA} />
                <Dropdown inline={true} label={"collection / target"} bind:selected_value={selected_collection} options={collection_target_options} />

                {#if $collection_should_update}
                    <button class="radio-update-btn" onclick={() => collections.update()}>update</button>
                {/if}
            </div>
        </div>

        <div class="radio-content">
            <div class="beatmap-list-panel">
                <BeatmapList
                    bind:this={beatmap_list_ref}
                    height={70}
                    on_remove={remove_callback}
                    on_remove_set={remove_set_callback}
                    list_manager={list}
                    mode={"radio"}
                    elements={card_elements}
                    show_header={false}
                    carousel={false}
                    direction={"left"}
                    max_card_width={true}
                />
            </div>

            <RadioTimeline />
        </div>
    </div>
</div>

<style>
    .radio-container {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        overflow: hidden;
        background-position: center;
        background-size: cover;
    }

    .radio-header {
        position: relative;
        z-index: 4;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
        padding: 20px 20px 0;
    }

    .search-slot {
        width: 100%;
        min-width: 0;
    }

    .filter-row {
        display: flex;
        align-items: stretch;
        flex-wrap: wrap;
        gap: 10px;
    }

    .results-count-inline {
        display: flex;
        align-items: center;
        color: var(--accent-color);
        font-size: 13px;
        font-family: "Torus SemiBold";
        white-space: nowrap;
    }

    .radio-update-btn {
        margin-left: auto;
        padding: 4px 8px;
        font-size: 13px;
        border: none;
        border-radius: 6px;
        background: var(--accent-color);
        color: white;
        font-family: "Torus SemiBold";
        cursor: pointer;
        transition:
            transform 0.15s ease,
            filter 0.15s ease;
    }

    .radio-update-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.05);
    }

    .radio-content {
        flex: 1;
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        width: 100%;
        gap: 14px;
        padding: 10px 0 0;
        min-width: 0;
    }

    .beatmap-list-panel {
        min-height: 0;
        overflow: hidden;
        background: transparent;
    }
</style>
