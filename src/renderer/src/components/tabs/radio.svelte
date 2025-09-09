<script>
    import { onMount, onDestroy } from "svelte";
    import { collections } from "../../lib/store/collections";
    import { ALL_BEATMAPS_KEY, DEFAULT_SORT_OPTIONS } from "../../lib/store/other";
    import { format_time, get_image_url } from "../../lib/utils/utils";
    import { get_audio_manager } from "../../lib/store/audio";
    import { get_beatmap_list } from "../../lib/store/beatmaps";
    import { get_beatmap_data } from "../../lib/utils/beatmaps";
    import { input } from "../../lib/store/input";

    // components
    import Search from "../utils/basic/search.svelte";
    import RadioControl from "../utils/audio/radio-control.svelte";
    import Beatmaps from "../beatmaps.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";

    const list = get_beatmap_list("radio");
    const audio = get_audio_manager("radio");

    const { selected, query, sort } = list;

    $: selected_beatmap = null;
    $: all_collections = collections.all_collections;
    $: selected_collection = collections.selected_radio;
    $: previous_songs = audio.previous_random_songs;
    $: beatmap_options = [{ label: "all beatmaps", value: ALL_BEATMAPS_KEY }, ...$all_collections.map((c) => ({ label: c.name, value: c.name }))];
    $: bg = "";

    const update_background_image = async () => {
        if (selected_beatmap?.image_path) {
            const url = await get_image_url(selected_beatmap.image_path);
            bg = `url(${url})`;
        } else {
            bg = "";
        }
    };

    const update_beatmaps = async (removed) => {
        // hide remove beatmap option if we're showing all beatmaps
        list.hide_remove.set($selected_collection.name == ALL_BEATMAPS_KEY);

        const beatmaps = await list.get_beatmaps($selected_collection.name, { unique: true, sort: $sort, force: !!removed });

        if (!beatmaps) {
            return;
        }

        list.set_beatmaps(beatmaps, $selected_collection, true);
        list.update_list_id($selected_collection.name);
    };

    // update selected map when hash changes
    $: if ($selected) {
        get_beatmap_data($selected).then((bm) => {
            selected_beatmap = bm;
            update_background_image();
        });
    } else {
        selected_beatmap = null;
        bg = "";
        audio.clean_audio();
    }

    // update beatmap list
    $: if ($selected_collection.name || $query || $sort) {
        update_beatmaps();
    }

    onMount(() => {
        // always reset state if no beatmaps are selected
        if (!selected_beatmap) {
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

            list.select_beatmap(data.hash, data.index);
            $previous_songs.pop();
        });

        update_background_image();
    });

    onDestroy(() => {
        input.unregister("f2", "shift+f2");
        list.hide_remove.set(false);
    });
</script>

<div class="content tab-content">
    <div class="radio-container" style="--radio-bg: {bg};">
        <div class="sidebar">
            <div class="sidebar-header">
                <Search bind:value={$query} placeholder="search beatmaps" />
                <div class="filter-container">
                    <Dropdown placeholder={"mode"} bind:selected_value={$selected_collection.name} options={beatmap_options} />
                    <Dropdown placeholder={"sort by"} bind:selected_value={$sort} options={DEFAULT_SORT_OPTIONS} />
                </div>
            </div>
            <Beatmaps
                {selected_collection}
                selected={$selected}
                unique={list.is_unique}
                tab_id={"radio"}
                show_invalid={false}
                key={$selected_collection.name}
                show_bpm={false}
                show_star_rating={false}
                show_status={false}
                center={true}
                max_width={true}
                show_control={false}
                remove_callback={update_beatmaps}
            />
        </div>

        <div class="radio-data">
            <div class="radio-beatmap" class:no-bg={!bg}>
                <div class="radio-beatmap-header">
                    <div class="status">playing</div>
                    <div class="status">{selected_beatmap?.status_text ?? "unknown"}</div>
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
                        <div class="stat-value">{selected_beatmap?.mapper || "---"}</div>
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

    .filter-container {
        display: flex;
        justify-content: space-around;
        gap: 10px;
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
