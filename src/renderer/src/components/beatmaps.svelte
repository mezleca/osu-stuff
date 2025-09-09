<script>
    import { onMount } from "svelte";
    import { collections } from "../lib/store/collections";
    import { show_notification } from "../lib/store/notifications";
    import { get_beatmap_list, osu_beatmaps } from "../lib/store/beatmaps";
    import { downloader } from "../lib/store/downloader";
    import { get_beatmap_data } from "../lib/utils/beatmaps";
    import { input } from "../lib/store/input";

    // components
    import VirtualList from "./utils/virtual-list.svelte";
    import BeatmapCard from "./cards/beatmap-card.svelte";
    import ContextMenu from "./utils/context-menu.svelte";

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
    export let on_update = () => {};

    const list = list_manager || get_beatmap_list(tab_id);
    const { beatmaps, selected, list_id, index } = list;

    let context_menu;
    let current_beatmap_hash = null; // store the current beatmap hash for context actions

    $: all_collections = collections.all_collections;
    $: should_hide_remove = list.hide_remove;

    const handle_control = async (type, hash) => {
        if (type == "add") {
            const beatmap = await get_beatmap_data(hash);
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
            remove_beatmap(hash);
        }
    };

    const remove_beatmap = (hash) => {
        // remove from the collection :+1:
        if ($selected_collection.name != "" && tab_id) {
            collections.remove_beatmap($selected_collection.name, hash);
        }

        // if the map has previously selected, deselect
        if ($selected == hash) {
            list.remove_selected();
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

    const handle_click = async (hash, index) => {
        const beatmap = await get_beatmap_data(hash);

        // ensure beatmap actually exists
        if (!beatmap) {
            return;
        }

        list.select_beatmap(hash, index);
    };

    const open_on_browser = (beatmap) => {
        if (!beatmap?.beatmapset_id) {
            return;
        }
        window.shell.open(`https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}`);
    };

    const handle_context_menu = async (event) => {
        if (!current_beatmap_hash || !show_context) {
            return;
        }

        // use the stored beatmap hash
        const beatmap = await get_beatmap_data(current_beatmap_hash);

        // get action from detail
        const action = event.detail;
        const id_parts = action.id.split("-");
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
                // move-CollectionName-BeatmapHash
                const collection_name = id_parts.slice(1, -1).join("-"); // handle collection names with dashes
                move_to(collection_name, beatmap.md5);
                break;
            case "delete":
                remove_beatmap(beatmap.md5);
                break;
        }
    };

    const get_context_options = async () => {
        if (!current_beatmap_hash || !show_context) {
            return [];
        }

        // use the stored beatmap hash
        const beatmap = await get_beatmap_data(current_beatmap_hash);

        if (!beatmap) {
            return [];
        }

        const collections_name = $all_collections
            .filter((c) => ($selected_collection ? c.name != $selected_collection.name : true))
            .map((c) => ({ id: `move-${c.name}-${beatmap.md5}`, text: c.name }));

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

    // not a great name...
    const handle_move_beatmap = async (direction) => {
        const new_index = direction == "previous" ? $index - 1 : $index + 1;

        if ((direction == "previous" && new_index < 0) || (direction == "next" && new_index > $beatmaps.length)) {
            console.log("not updating selected beatmap (reached list limit):", new_index);
            return;
        }

        const hash = $beatmaps[new_index];
        list.select_beatmap(hash, new_index);
    };

    const on_context = async (event, hash) => {
        // ensure we have a valid beatmap
        if (!hash) {
            console.log("context: invalid beatmap hash");
            return;
        }

        // store the current beatmap hash for later use
        current_beatmap_hash = hash;

        // show context menu at cursor position
        context_menu.show(event);
    };

    onMount(() => {
        input.on("ArrowLeft", () => handle_move_beatmap("previous"));
        input.on("ArrowRight", () => handle_move_beatmap("next"));

        // on destroy
        return () => {
            input.remove("ArrowLeft", "ArrowRight");
        };
    });
</script>

<div class="beatmaps-container">
    <!-- render beatmap matches-->
    <div class="beatmaps-header">
        <div class="results-count">{$beatmaps?.length ?? 0} matches</div>
    </div>

    <!-- render context menu -->
    {#if show_context}
        <ContextMenu bind:this={context_menu} onclick={handle_context_menu} options={get_context_options} />
    {/if}

    <!-- render beatmaps virtual list-->
    <VirtualList
        items={$beatmaps}
        key={$list_id}
        count={$beatmaps?.length ?? 0}
        width="100%"
        height="100%"
        item_height={height}
        selected={$index}
        {max_width}
        {carousel}
        {tab_id}
        {direction}
        {columns}
        {on_update}
        let:index
    >
        <!-- get current md5 hash -->
        {@const hash = $beatmaps[index]}

        <!-- render beatmap card -->
        <BeatmapCard
            selected={$selected}
            {hash}
            {show_bpm}
            {show_star_rating}
            {show_status}
            {set}
            {center}
            {show_control}
            {show_remove}
            control={(type) => handle_control(type, hash)}
            on_click={() => handle_click(hash, index)}
            on_context={(e) => on_context(e, hash)}
        />
    </VirtualList>
</div>
