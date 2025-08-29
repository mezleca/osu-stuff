<script>
    import { collections } from "../lib/store/collections";
    import { show_notification } from "../lib/store/notifications";
    import { get_beatmap_list, osu_beatmaps } from "../lib/store/beatmaps";
    import { downloader } from "../lib/store/downloader";
    import { get_beatmap_data } from "../lib/utils/beatmaps";
    import { ContextMenu } from "wx-svelte-menu";

    // components
    import VirtualList from "./utils/virtual-list.svelte";
    import BeatmapCard from "./cards/beatmap-card.svelte";

    // props
    export let tab_id; // fallback in case the user dont pass the list directly
    export let selected_collection;
    export let carousel;
    export let show_bpm = true;
    export let show_remove = true;
    export let show_star_rating = true;
    export let show_status = true;
    export let center = false;
    export let show_context = true;
    export let max_width;
    export let height = 100;
    export let columns = 0;
    export let direction;
    export let list_manager = null;
    export let set = false;
    export let show_control = true;
    export let remove_callback = () => {};
    export let on_update = null;

    const list = list_manager || get_beatmap_list(tab_id);
    const { beatmaps, selected } = list;

    $: all_collections = collections.all_collections;
    $: should_hide_remove = list.hide_remove;
    $: selected_index = $beatmaps && $selected ? $beatmaps.findIndex((hash) => hash == $selected.md5) : -1;

    const handle_control = async (type, beatmap) => {
        if (type == "add") {
            const result = await downloader.single_download(beatmap);

            if (!result) {
                return;
            }

            // is a set
            if (result.beatmaps) {
                result.beatmaps.map(async (b) => {
                    await window.osu.add_beatmap(b.md5, b);
                    osu_beatmaps.add(b.md5, b);
                });
            } else {
                await window.osu.add_beatmap(result.md5, result);
                osu_beatmaps.add(result.md5, result);
            }

            // force list redraw (if possible)
            if (list.reload_beatmaps) list.reload_beatmaps();
        } else {
            remove_beatmap(beatmap.md5);
        }
    };

    const remove_beatmap = (hash) => {
        if ($selected_collection.name != "" && tab_id) {
            collections.remove_beatmap($selected_collection.name, hash);
        }

        remove_callback();
    };

    const move_to = (name, hash) => {
        const collection = collections.get(name);

        if (!collection) {
            show_notification({ type: "error", text: `failed to get ${name}` });
            return;
        }

        if (!collection.maps.includes(hash)) {
            collection.maps.push(hash);
            collections.replace(collection);
            collections.needs_update.set(true);
        }
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
        if (!event.action) {
            return;
        }

        const id_parts = event.action.id.split("-");
        const type = id_parts[0];

        switch (type) {
            case "browser":
                open_on_browser(beatmap);
                break;
            case "export":
                // single beatmap export
                if (beatmap && beatmap.md5) {
                    window.osu.export_beatmap(beatmap);
                }
                break;
            case "move":
                move_to(id_parts[1], id_parts[2]);
                break;
            case "delete":
                remove_beatmap(beatmap.md5);
                break;
        }
    };

    const get_context_options = (beatmap, hash) => {
        const collections_name = $all_collections
            .filter((c) => ($selected_collection ? c.name != $selected_collection.name : true))
            .map((c) => ({ id: `move-${c.name}-${hash}`, text: c.name }));

        const result = [{ id: "browser", text: "open in browser" }];

        if (collections_name.length > 0) {
            result.push({ id: "move", text: "move beatmap to", data: collections_name });
        }

        if (!$should_hide_remove) {
            result.push({ id: "delete", text: "delete beatmap" });
        }

        if (beatmap?.downloaded) {
            result.push({ id: "export", text: "export beatmap" });
        }

        return result;
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
        {columns}
        {on_update}
        let:index
    >
        {@const hash = $beatmaps[index]}
        {#await get_beatmap_data(hash) then beatmap}
            {#if show_context}
                <ContextMenu onclick={(event) => handle_context_menu(event, beatmap)} options={get_context_options(beatmap, hash)} at="point">
                    <BeatmapCard
                        {beatmap}
                        {show_bpm}
                        {show_star_rating}
                        {show_remove}
                        {show_status}
                        {show_control}
                        {set}
                        {center}
                        selected={$selected && (list.is_unique ? $selected.unique_id == beatmap.unique_id : $selected.md5 == beatmap.md5)}
                        control={show_remove ? (type) => handle_control(type, beatmap) : null}
                        click={() => handle_click(beatmap, index)}
                    />
                </ContextMenu>
            {:else}
                <BeatmapCard
                    {beatmap}
                    {show_bpm}
                    {show_star_rating}
                    {show_status}
                    {set}
                    {center}
                    {show_control}
                    selected={$selected && (list.is_unique ? $selected.unique_id == beatmap.unique_id : $selected.md5 == beatmap.md5)}
                    control={(type) => handle_control(type, beatmap)}
                    click={() => handle_click(beatmap, index)}
                />
            {/if}
        {/await}
    </VirtualList>
</div>
