<script>
    import { collections, selected_collection } from "../lib/store/collections";
    import { get_beatmap_list } from "../lib/store/beatmaps";
    import { show_notification } from "../lib/store/notifications";
    import { get_beatmap_data } from "../lib/utils/beatmaps";
    import { ContextMenu } from "wx-svelte-menu";

    // components
    import VirtualList from "./utils/virtual-list.svelte";
    import BeatmapCard from "./cards/beatmap-card.svelte";

    // props
    export let tab_id;
    export let carousel;
    export let show_bpm = true;
    export let show_star_rating = true;
    export let show_beatmap_status = true;
    export let selected_beatmap;
    export let max_width;
    export let height = 100;
    export let direction;
    export let remove_callback = () => {};

    const list = get_beatmap_list(tab_id);
    const { beatmaps, selected } = list;

    $: if ($selected) {
        selected_beatmap = $selected;
    }

    $: selected_index = $beatmaps && $selected ? $beatmaps.findIndex((hash) => hash == $selected.md5) : -1;

    const handle_control = (type, beatmap) => {
        if (type == "add") {
            show_notification("todo");
        } else {
            remove_beatmap(beatmap.md5);
        }
    };

    const remove_beatmap = (hash) => {
        if ($selected_collection?.name) {
            collections.remove_beatmap($selected_collection.name, hash);
        }
        remove_callback();
    };

    const handle_click = (beatmap, index) => {
        list.select_beatmap(beatmap, index);
    };

    const open_on_browser = (beatmap) => {
        if (!beatmap?.beatmapset_id) {
            return;
        }
        window.shell.open(`https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}`);
    };

    const handle_context_menu = (event, beatmap) => {
        const type = event.action?.id;

        switch (type) {
            case "browser":
                open_on_browser(beatmap);
                break;
            case "download":
                break;
            case "export":
                break;
            case "delete":
                remove_beatmap(beatmap.md5);
                break;
        }
    };

    const get_context_options = (beatmap) => {
        if (beatmap?.downloaded) {
            return [
                { id: "browser", text: "open in browser" },
                { id: "download", text: "download beatmap" },
                { id: "export", text: "export beatmap" },
                { id: "delete", text: "delete beatmap" }
            ];
        } else if (!beatmap?.downloaded && beatmap?.beatmapset_id) {
            return [
                { id: "browser", text: "open in browser" },
                { id: "download", text: "download beatmap" },
                { id: "delete", text: "delete beatmap" }
            ];
        } else {
            return [
                { id: "download", text: "download beatmap" },
                { id: "delete", text: "delete beatmap" }
            ];
        }
    };
</script>

<div class="beatmaps-container">
    <div class="beatmaps-header">
        <div class="results-count">{$beatmaps?.length ?? 0} matches</div>
    </div>
    <VirtualList
        count={$beatmaps?.length ?? 0}
        width="100%"
        height="100%"
        item_height={height}
        selected={selected_index}
        {max_width}
        {carousel}
        {tab_id}
        {direction}
        let:index
    >
        {@const hash = $beatmaps[index]}
        {#await get_beatmap_data(hash) then beatmap}
            <ContextMenu onclick={(event) => handle_context_menu(event, beatmap)} options={get_context_options(beatmap)} at="point">
                <BeatmapCard
                    {beatmap}
                    {show_bpm}
                    {show_star_rating}
                    {show_beatmap_status}
                    selected={$selected && (list.is_unique ? $selected.unique_id == beatmap.unique_id : $selected.md5 == beatmap.md5)}
                    control={(type) => handle_control(type, beatmap)}
                    click={() => handle_click(beatmap, index)}
                />
            </ContextMenu>
        {/await}
    </VirtualList>
</div>
