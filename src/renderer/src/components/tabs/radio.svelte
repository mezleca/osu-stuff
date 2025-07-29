<script>
    import { onMount } from "svelte";
    import { collections } from "../../lib/store/collections";
    import { ALL_BEATMAPS_KEY, DEFAULT_SORT_OPTIONS } from "../../lib/store/other";
    import { radio_mode } from "../../lib/store/audio";
    import { format_time, get_image_url } from "../../lib/utils/utils";
    import { get_beatmap_list } from "../../lib/store/beatmaps";

    const list = get_beatmap_list("radio");
    const { selected, query, sort } = list;

    // components
    import Search from "../utils/basic/search.svelte";
    import RadioControl from "../utils/audio/radio-control.svelte";
    import Beatmaps from "../beatmaps.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";

    // misc
    import PlaceholderImg from "../../assets/placeholder.png";

    $: all_collections = collections.collections;
    $: beatmap = $selected;
    $: bg = PlaceholderImg;

    $: beatmap_options = [{ label: "all beatmaps", value: ALL_BEATMAPS_KEY }, ...$all_collections.map((c) => ({ label: c.name, value: c.name }))];

    const update_background_image = () => {
        if (beatmap && beatmap?.image_path) {
            get_image_url(beatmap.image_path).then((url) => (bg = url));
        } else {
            bg = PlaceholderImg;
        }
    };

    const update_beatmaps = async () => {
        const beatmaps = await list.get_beatmaps($radio_mode, { unique: true, sort: $sort });
        list.set_beatmaps(beatmaps, $radio_mode, true);
    };

    $: if (beatmap) {
        update_background_image();
    }

    $: if ($radio_mode || $query || $sort) {
        update_beatmaps();
    }

    onMount(() => {
        if ($radio_mode == "") $radio_mode = ALL_BEATMAPS_KEY;
        update_background_image();
    });
</script>

<div class="content tab-content">
    <div class="radio-container" style="--radio-bg: url({bg});">
        <div class="sidebar">
            <div class="sidebar-header">
                <Search bind:value={$query} placeholder="search beatmaps" />
                <div class="filter-container">
                    <Dropdown placeholder={"mode"} bind:selected_value={$radio_mode} options={beatmap_options} />
                    <Dropdown placeholder={"sort by"} bind:selected_value={$sort} options={DEFAULT_SORT_OPTIONS} />
                </div>
            </div>
            <Beatmaps
                tab_id={"radio"}
                show_invalid={false}
                key={$radio_mode}
                show_bpm={false}
                show_star_rating={false}
                show_status={false}
                center={true}
                max_width={true}
                bind:selected_beatmap={beatmap}
                direction="left"
            />
        </div>

        <div class="radio-data">
            <div class="radio-beatmap">
                <div class="radio-beatmap-header">
                    <div class="status">playing</div>
                    <div class="status">{beatmap?.status_text ?? "unknown"}</div>
                </div>

                <div class="song-info">
                    <div class="title">{beatmap?.title || "No song selected"}</div>
                    <div class="artist">{beatmap?.artist || ""}</div>
                </div>

                <div class="stats">
                    <div class="stat">
                        <div class="stat-label">BPM</div>
                        <div class="stat-value">{beatmap?.bpm || "---"}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">DURATION</div>
                        <div class="stat-value">{beatmap?.duration ? format_time(beatmap?.duration) : "---"}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">MAPPED BY</div>
                        <div class="stat-value">{beatmap?.mapper || "---"}</div>
                    </div>
                </div>

                <div class="radio-controls">
                    {#if beatmap?.md5}
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
        z-index: 1;
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
        background-image: var(--radio-bg);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: 1;
        filter: brightness(0.05);
        transition: all 0.3s;
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
