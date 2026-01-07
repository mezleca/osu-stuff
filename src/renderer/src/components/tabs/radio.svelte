<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    import { collections } from "../../lib/store/collections";
    import { ALL_BEATMAPS_KEY, FILTER_TYPES } from "../../lib/store/other";
    import { debounce, format_time, url_from_media } from "../../lib/utils/utils";
    import { get_audio_manager } from "../../lib/store/audio";
    import { get_beatmap_list } from "../../lib/store/beatmaps";
    import { get_beatmap } from "../../lib/utils/beatmaps";
    import { type IBeatmapResult } from "@shared/types";
    import { input } from "../../lib/store/input";

    // components
    import Search from "../utils/basic/search.svelte";
    import RadioControl from "../utils/audio/radio-control.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import BeatmapList from "../beatmap-list.svelte";

    const list = get_beatmap_list("radio");
    const audio = get_audio_manager("radio");

    const { selected, query, sort, target, should_update } = list;

    let selected_beatmap: IBeatmapResult | null = null;

    $: selected_collection = collections.selected_radio;
    $: previous_songs = list.previous_buffer;
    $: bg = "";

    const collection_target_options = [
        { label: "all beatmaps", value: ALL_BEATMAPS_KEY },
        ...collections.get_all().map((c) => ({ label: c.name, value: c.name }))
    ];

    const update_background_image = async () => {
        if (!selected_beatmap) {
            bg = "";
            return;
        }

        const local = selected_beatmap.background ? url_from_media(selected_beatmap.background) : "";
        const web = selected_beatmap.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${selected_beatmap.beatmapset_id}/covers/cover.jpg` : "";

        if (local && web) {
            bg = `url("${local}"), url("${web}")`;
        } else {
            bg = local ? `url("${local}")` : web ? `url("${web}")` : "";
        }
    };

    const update_beatmaps = debounce(async (force: boolean = false) => {
        list.show_remove.set($target == ALL_BEATMAPS_KEY);

        const result = await list.search(force);

        if (!result) {
            return;
        }

        const beatmaps = result.beatmaps.map((b) => b.md5);
        list.set_items(beatmaps, undefined, false);
    }, 100);

    const get_next_id_callback = async (direction: any) => {
        const beatmaps = list.get_items();

        if (beatmaps.length == 0) {
            return null;
        }

        const current_index = $selected.index;
        const next_idx = audio.calculate_next_index(current_index, beatmaps.length, direction);

        audio.force_random.set(false);

        const beatmap_id = beatmaps[next_idx];
        list.previous_buffer.update((old) => [...old, { md5: beatmap_id, index: next_idx }]);

        if (next_idx != current_index) {
            list.select(beatmap_id, next_idx);
        }

        return beatmap_id;
    };

    const get_beatmap_callback = async (beatmap_id: string) => {
        return await get_beatmap(beatmap_id);
    };

    $: if ($selected?.md5 && $selected.index != -1 && audio.get_state().id != $selected.md5 && !audio.get_state().is_loading) {
        const beatmap_id = $selected.md5;
        audio.load_and_setup_audio(beatmap_id).then(async (result) => {
            if (result) {
                await audio.play();
            }
        });
    }

    $: if ($selected && $selected?.index != -1) {
        get_beatmap($selected.md5).then((bm) => {
            selected_beatmap = bm;
            update_background_image();
        });
    } else {
        selected_beatmap = null;
        bg = "";
        audio.clean_audio();
    }

    $: if ($selected_collection.name || $query || $sort || $target || $should_update) {
        update_beatmaps($should_update);
    }

    onMount(() => {
        list.show_unique.set(true);

        audio.set_callbacks({
            get_next_id: get_next_id_callback,
            get_beatmap: get_beatmap_callback
        });

        // always reset state if no beatmaps are selected
        if ($selected?.index == -1) {
            audio.clean_audio();
        }

        // default selected "collection" to all beatmaps
        if ($selected_collection.name == "") collections.select(ALL_BEATMAPS_KEY, true);

        // select random
        input.on("f2", () => {
            audio.force_random.set(true);
        });

        // get previous random songs
        input.on("shift+f2", async () => {
            const index = $previous_songs.length - 2;
            const data = $previous_songs[index];

            if (!data) {
                return;
            }

            list.select(data.md5, data.index);
            $previous_songs.pop();
        });

        update_background_image();
    });

    onDestroy(() => {
        input.unregister("f2", "shift+f2");
        list.show_remove.set(true);
    });
</script>

<div class="content tab-content">
    <div class="radio-container" style="--radio-bg: {bg};">
        <div class="sidebar">
            <div class="sidebar-header" style="z-index: 999999;">
                <Search bind:value={$query} placeholder="search beatmaps" />
                <Dropdown label={"sort by"} bind:selected_value={$sort} options={FILTER_TYPES} />
                <Dropdown label={"target"} bind:selected_value={$target} options={collection_target_options} />
            </div>
            <BeatmapList list_manager={list} carousel={false} direction={"left"} max_card_width={true} simplified={true} />
        </div>

        <div class="radio-data">
            <div class="radio-beatmap" class:no-bg={!bg}>
                <div class="radio-beatmap-header">
                    <div class="status">playing</div>
                    <div class="status">{selected_beatmap?.status ?? "unknown"}</div>
                </div>

                <div class="song-info">
                    <div class="title">{selected_beatmap?.title || "No song selected"}</div>
                    <div class="artist">{selected_beatmap?.artist || ""}</div>
                </div>

                <div class="stats">
                    <div class="stat">
                        <div class="stat-label">BPM</div>
                        <div class="stat-value">{selected_beatmap?.bpm || "---"}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">DURATION</div>
                        <div class="stat-value">{selected_beatmap?.duration ? format_time(selected_beatmap?.duration) : "---"}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">MAPPED BY</div>
                        <div class="stat-value">{selected_beatmap?.creator || "---"}</div>
                    </div>
                </div>

                <div class="radio-controls">
                    {#if selected_beatmap?.md5}
                        <RadioControl />
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .radio-container {
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        --radio-bg: none;
    }

    .sidebar {
        max-width: 40%;
        z-index: 1;
        background-color: rgba(18, 18, 18, 0.95);
    }

    .radio-data {
        flex: 1;
        position: relative;
        overflow: hidden;
        padding: 20px;
        background-color: rgba(18, 18, 18, 0.95);
    }

    .radio-beatmap {
        background: var(--bg-tertiary);
        backdrop-filter: blur(15px);
        border-radius: 4px;
        padding: 24px;
        width: 100%;
        height: 100%;
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-rows: auto auto auto 1fr auto;
        gap: 24px;
    }

    .radio-beatmap::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        background: var(--radio-bg, linear-gradient(90deg, rgba(23, 50, 82, 1) 0%, rgba(74, 19, 89, 1) 100%));
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: 1;
        filter: brightness(0.05);
        transition:
            background-image 0.3s ease,
            opacity 0.3s ease;
    }

    .radio-beatmap.no-bg::before {
        background: linear-gradient(90deg, rgba(23, 50, 82, 1) 0%, rgba(74, 19, 89, 1) 100%);
        background-image: none;
    }

    .radio-beatmap-header {
        display: flex;
        justify-content: space-between;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .status {
        color: var(--text-color);
        font-size: 12px;
        text-transform: uppercase;
        opacity: 0.8;
    }

    .song-info .title {
        font-size: 24px;
        color: #ffffff;
        margin-bottom: 8px;
    }

    .song-info .artist {
        font-size: 18px;
        color: var(--text-muted);
    }

    .stats {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 16px;
        background: rgba(19, 19, 19, 0.8);
        border-radius: 4px;
    }

    .stat {
        text-align: center;
        flex: 1;
    }

    .stat:not(:last-child) {
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        padding-right: 12px;
    }

    .stat-label {
        color: #666;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
    }

    .stat-value {
        color: #ffffff;
        font-size: 16px;
    }

    .radio-controls {
        align-self: end;
    }
</style>
