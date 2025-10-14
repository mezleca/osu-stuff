<script>
    import { onMount } from "svelte";
    import { collections } from "../lib/store/collections";
    import { show_notification } from "../lib/store/notifications";
    import { get_beatmap_list, osu_beatmaps } from "../lib/store/beatmaps";
    import { downloader } from "../lib/store/downloader";
    import { get_beatmap_data, get_missing_beatmaps } from "../lib/utils/beatmaps";
    import { get_popup_manager, PopupAddon, show_popup } from "../lib/store/popup";
    import { input } from "../lib/store/input";

    // components
    import VirtualList from "./utils/virtual-list.svelte";
    import BeatmapCard from "./cards/beatmap-card.svelte";
    import ContextMenu from "./utils/context-menu.svelte";
    import Popup from "./utils/popup/popup.svelte";

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
    export let show_missing = false;
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
    const popup_manager = get_popup_manager("beatmaps");
    const { beatmaps, selected, multi_selected, list_id } = list;

    let context_menu;
    let current_beatmap_hash = null; // store the current beatmap hash for context actions

    $: missing_beatmaps = collections.missing_beatmaps;
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
            list.clear_selected();
        }

        remove_callback(hash);
    };

    const move_to = (name, hash) => {
        const collection = collections.get(name);
        const is_multiple = $multi_selected.length > 1;

        if (!collection) {
            show_notification({ type: "error", text: `failed to get ${name}` });
            return;
        }

        let moved_something = false;

        if (is_multiple) {
            for (const actual_hash of $multi_selected) {
                if (collection.maps.includes(actual_hash)) continue;
                collection.maps.push(actual_hash);
                moved_something = true;
            }
        } else {
            if (!collection.maps.includes(hash)) {
                collection.maps.push(hash);
                moved_something = true;
            }
        }

        if (moved_something) {
            collections.replace(collection);
            collections.needs_update.set(true);
            list.clear_multi_selected();
        }
    };

    const handle_click = async (hash, index) => {
        const beatmap = await get_beatmap_data(hash);

        // ensure beatmap actually exists
        if (!beatmap) {
            return;
        }

        // multi selecting
        if (input.is_pressed("control")) {
            list.multi_select([hash], true);
        } else {
            list.clear_multi_selected();
            list.select(hash, index);
        }
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
        const is_multiple = $multi_selected.length > 1;

        switch (type) {
            case "browser":
                open_on_browser(beatmap);
                break;
            case "export":
                if (is_multiple) {
                    for (const md5 of $multi_selected) {
                        if (map.downloaded) {
                            window.osu.export_beatmap({ md5 });
                        }
                    }
                } else {
                    if (beatmap && beatmap.md5) {
                        window.osu.export_beatmap(beatmap);
                    }
                }
                break;
            case "move":
                const collection_name = id_parts.slice(1, -1).join("-"); // handle collection names with dashes
                move_to(collection_name, beatmap.md5);
                break;
            case "delete":
                if (is_multiple) {
                    for (const md5 of $multi_selected) {
                        remove_beatmap(md5);
                    }
                    list.clear_multi_selected();
                } else {
                    remove_beatmap(beatmap.md5);
                }
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

        const suffix = $multi_selected.length > 1 ? "s" : "";

        const collections_name = $all_collections
            .filter((c) => ($selected_collection ? c.name != $selected_collection.name : true))
            .map((c) => ({ id: `move-${c.name}-${beatmap.md5}`, text: c.name }));

        const result = [{ id: "browser", text: "open in browser" }];

        if (collections_name.length > 0) {
            result.push({ id: "move", text: `move beatmap${suffix} to`, data: collections_name });
        }

        if (!$should_hide_remove) {
            result.push({ id: "delete", text: `delete beatmap${suffix}` });
        }

        if (beatmap?.downloaded) {
            result.push({ id: "export", text: `export beatmap${suffix}` });
        }

        return result;
    };

    const handle_move_beatmap = async (direction) => {
        const index = $selected.index;
        const new_index = direction == "previous" ? index - 1 : index + 1;

        if ((direction == "previous" && new_index < 0) || (direction == "next" && new_index > $beatmaps.length)) {
            console.log("not updating selected beatmap (reached list limit):", new_index);
            return;
        }

        const hash = $beatmaps[new_index];
        list.select(hash, new_index);
    };

    const handle_missing_beatmaps = async (data) => {
        const invalid = [];

        for (const missing of $missing_beatmaps) {
            // only include the beatmaps from the selected collection
            if (data.collections.includes(missing.name)) {
                invalid.push(...missing.beatmaps);
            }
        }

        downloader.add({ name: `missing: ${data.collections.join("-")}`, beatmaps: invalid });
    };

    const create_missing_beatmaps_popup = async () => {
        const addon = new PopupAddon();

        addon.add({
            id: "collections",
            type: "buttons",
            label: "collections to download",
            multiple: true,
            data: () => $missing_beatmaps.map((m) => m.name)
        });
        addon.set_callback(handle_missing_beatmaps);

        popup_manager.register("missing", addon);
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
        // select everything :D
        input.on("control+a", () => {
            list.multi_select($beatmaps, false);
        });

        // setup beatmap navigation
        input.on("ArrowLeft", () => handle_move_beatmap("previous"));
        input.on("ArrowRight", () => handle_move_beatmap("next"));

        // setup popups
        create_missing_beatmaps_popup();

        if (show_missing) get_missing_beatmaps();

        // on destroy
        return () => {
            input.remove("ArrowLeft", "ArrowRight", "control+a");
        };
    });
</script>

<div class="beatmaps-container">
    <Popup key="beatmaps" />

    <!-- render beatmap matches-->
    <div class="beatmaps-header">
        <div class="results-count">{$beatmaps?.length ?? 0} matches</div>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        {#if show_missing && $missing_beatmaps.length != 0}
            <div class="missing-button" onclick={() => show_popup("missing", "beatmaps")}>missing beatmaps</div>
        {/if}
    </div>

    <!-- render context menu -->
    {#if show_context}
        <ContextMenu bind:this={context_menu} onclick={handle_context_menu} options={get_context_options} />
    {/if}

    <!-- render beatmaps virtual list-->
    <VirtualList
        items={$beatmaps}
        key={`${$list_id}-${$beatmaps?.length ?? 0}`}
        count={$beatmaps?.length ?? 0}
        width="100%"
        height="100%"
        item_height={height}
        selected={$selected.index}
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
        {@const selected = hash && $selected.index != -1 ? $selected.md5 == hash : false}
        {@const highlighted = hash && $multi_selected.length > 0 ? $multi_selected.includes(hash) : false}

        <!-- render beatmap card -->
        <BeatmapCard
            {selected}
            {highlighted}
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

<style>
    .results-count {
        color: var(--accent-color);
        font-size: 13px;
    }

    .missing-button {
        border: none;
        padding: 6px 8px;
        transition: all 0.2s;
        border-radius: 6px;
        font-size: 14px;
    }

    .missing-button:hover {
        background-color: var(--accent-color);
        transform: scale(1.02);
    }
</style>
