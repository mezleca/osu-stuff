<script lang="ts">
    import { onMount } from "svelte";

    import { collections } from "../../lib/store/collections";
    import { FILTER_DATA, SEARCH_DEBOUNCE_INTERVAL } from "../../lib/store/other";
    import { ALL_BEATMAPS_KEY } from "@shared/types";
    import { format_time, url_to_media } from "../../lib/utils/utils";
    import { debounce } from "../../lib/utils/timings";
    import { get_audio_manager } from "../../lib/store/audio";
    import { get_beatmap_list } from "../../lib/store/beatmaps";
    import { get_beatmap, remove_beatmap_from_collection, remove_beatmapset_from_collection } from "../../lib/utils/beatmaps";
    import { type IBeatmapResult } from "@shared/types";
    import { input } from "../../lib/store/input";
    import { config } from "../../lib/store/config";

    // components
    import Search from "../utils/basic/search.svelte";
    import RadioControl from "../utils/audio/radio-control.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import BeatmapList from "../beatmap-list.svelte";

    // @ts-ignore
    import PLACEHOLDER_IMAGE from "@assets/images/fallback.png";

    const list = get_beatmap_list("radio");
    const audio = get_audio_manager("radio");
    const selected_store = collections.get_selected_store("radio");

    const { selected, query, sort, should_update } = list;

    let selected_beatmap: IBeatmapResult | null = null;

    $: selected_collection = $selected_store.name || ALL_BEATMAPS_KEY;
    $: previous_songs = list.previous_buffer;
    $: bg = "";

    const collection_target_options = [
        { label: "all beatmaps", value: ALL_BEATMAPS_KEY },
        ...collections.get_all().map((c) => ({ label: c.name, value: c.name }))
    ];

    const update_background_image = async () => {
        if (!$config.radio_background) {
            bg = "";
            return;
        }

        if (!selected_beatmap) {
            bg = "";
            return;
        }

        const local = selected_beatmap.background ? url_to_media(selected_beatmap.background) : "";
        const web = selected_beatmap.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${selected_beatmap.beatmapset_id}/covers/cover.jpg` : "";

        bg = local != "" ? local : web;
    };

    const debounced_update = debounce(async (force: boolean = false) => {
        list.set_target(selected_collection);

        const result = await list.search(force);

        if (!result) {
            return;
        }

        const beatmaps = result.beatmaps.map((b) => b.md5);
        list.set_items(beatmaps);
    }, SEARCH_DEBOUNCE_INTERVAL);

    const retry_random = debounce(() => audio.force_random.set(true), 200);
    const trigger_random = debounce(() => audio.force_random.set(true), 50);

    const SEEK_OFFSET_SECONDS = 5;

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

    const pick_next_valid_id = async (direction: any) => {
        const beatmaps = list.get_items();

        if (beatmaps.length == 0) {
            return null;
        }

        const tried = new Set<number>();
        let attempts = 0;
        let current_index = $selected?.index ?? 0;

        while (attempts < beatmaps.length) {
            const next_idx = audio.calculate_next_index(current_index, beatmaps.length, direction);

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

    const commit_next_id = (data: { beatmap_id: string; index: number }) => {
        list.previous_buffer.update((old) => [...old, { md5: data.beatmap_id, index: data.index }]);

        if (!$selected || data.index != $selected.index) {
            list.select(data.beatmap_id, data.index);
        }
    };

    const get_next_id_callback = async (direction: any) => {
        const result = await pick_next_valid_id(direction);

        audio.force_random.set(false);

        if (!result) {
            if (direction === 0) {
                retry_random();
            }
            return null;
        }

        commit_next_id(result);
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
        collections.filter();
    };

    const remove_set_callback = async (id: number) => {
        const hashes = await remove_beatmapset_from_collection(id, selected_collection);
        const current_items = list.get_items();
        const new_items = current_items.filter((md5) => hashes.includes(md5));

        list.set_items(new_items);
        collections.filter();
    };

    $: {
        // load audio on changes
        if ($selected?.md5 && $selected.index != -1 && audio.get_state().id != $selected.md5 && !audio.get_state().is_loading) {
            const beatmap_id = $selected.md5;
            audio.load_and_setup_audio(beatmap_id).then(async (result) => {
                if (result) {
                    await audio.play();
                }
            });
        }

        // update selected beatmap data on changes
        if ($selected && $selected?.index != -1) {
            get_beatmap($selected.md5).then((bm) => {
                selected_beatmap = bm;
                update_background_image();
            });
        } else {
            selected_beatmap = null;
            bg = "";
            audio.clean_audio();
        }

        // update selection collection on change
        if (selected_collection && $selected_store.name != selected_collection) {
            // fallback to all beatmaps if the collection was deleted
            if (selected_collection != ALL_BEATMAPS_KEY && !collections.has(selected_collection)) {
                selected_collection = ALL_BEATMAPS_KEY;
            }

            collections.select(selected_collection, "radio");
        }

        if (selected_collection || $query || $sort || $should_update) {
            debounced_update($should_update);
        }

        if ($config.radio_background) {
            update_background_image();
        } else {
            bg = "";
        }
    }

    onMount(() => {
        list.show_unique.set(true);
        list.has_duration.set(true);

        audio.set_callbacks({
            get_next_id: get_next_id_callback,
            get_beatmap: get_beatmap_callback
        });

        // always reset state if no beatmaps are selected
        if ($selected?.index == -1) {
            audio.clean_audio();
        }

        // select random
        const handle_random_id = input.on("f2", () => {
            trigger_random();
        });

        // get previous random songs
        const handle_previous_id = input.on("shift+f2", async () => {
            const index = $previous_songs.length - 2;
            const data = $previous_songs[index];

            if (!data) {
                return;
            }

            list.select(data.md5, data.index);
            $previous_songs.pop();
        });

        const handle_seek_backward_id = input.on("shift+arrowleft", () => {
            seek_by_seconds(-SEEK_OFFSET_SECONDS);
        });

        const handle_seek_forward_id = input.on("shift+arrowright", () => {
            seek_by_seconds(SEEK_OFFSET_SECONDS);
        });

        update_background_image();

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
    <div class="radio-container">
        <div class="sidebar">
            <div class="sidebar-header" style="z-index: 999999;">
                <Search bind:value={$query} placeholder="search beatmaps" />
                <Dropdown label={"sort by"} bind:selected_value={$sort} options={FILTER_DATA} />
                <Dropdown label={"target"} bind:selected_value={selected_collection} options={collection_target_options} />
            </div>
            <BeatmapList
                on_remove={remove_callback}
                on_remove_set={remove_set_callback}
                list_manager={list}
                carousel={false}
                direction={"left"}
                max_card_width={true}
                simplified={true}
            />
        </div>

        <div class="radio-data" class:no-bg={!bg}>
            {#if bg}
                <img class="radio-background" src={bg} onerror={() => (bg = PLACEHOLDER_IMAGE)} alt="" />
            {/if}
            <div class="radio-beatmap">
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
    }

    .radio-data.no-bg {
        background: linear-gradient(90deg, rgba(28, 24, 26, 1) 0%, rgba(33, 18, 22, 1) 100%);
    }

    .radio-beatmap {
        border-radius: 4px;
        padding: 24px;
        width: 100%;
        height: 100%;
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-rows: auto auto auto 1fr auto;
        gap: 24px;
        z-index: 1;
    }

    .radio-background {
        position: absolute;
        z-index: 0;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        filter: brightness(0.1);
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
        backdrop-filter: blur(10px);
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
