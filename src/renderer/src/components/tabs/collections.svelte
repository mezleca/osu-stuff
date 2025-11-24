<script lang="ts">
    import { onMount } from "svelte";
    import { collections } from "../../lib/store/collections";
    import {
        get_from_osu_collector,
        get_legacy_collection_data,
        get_osdb_data,
        export_collections,
        export_beatmaps
    } from "../../lib/utils/collections";
    import { ALL_STATUS_KEY, DEFAULT_SORT_OPTIONS, DEFAULT_STATUS_TYPES } from "../../lib/store/other";
    import { get_beatmap_list, cached_beatmaps } from "../../lib/store/beatmaps";
    import { get_popup_manager, show_popup } from "../../lib/store/popup/store";
    import { PopupBuilder } from "../../lib/store/popup/builder";
    import { show_notification } from "../../lib/store/notifications";
    import { get_missing_beatmaps, get_player_data, remove_beatmap } from "../../lib/utils/beatmaps";
    import { config } from "../../lib/store/config";
    import { context_separator, debounce, string_is_valid } from "../../lib/utils/utils";

    // components
    import Add from "../utils/add.svelte";
    import Search from "../utils/basic/search.svelte";
    import CollectionCard from "../cards/collection-card.svelte";
    import Popup from "../utils/popup/popup.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import RangeSlider from "../utils/basic/range-slider.svelte";
    import Checkbox from "../utils/basic/checkbox.svelte";
    import { type ICollectionResult, type StarRatingFilter, BeatmapStatus } from "@shared/types";
    import { text_to_data } from "../../lib/store/popup/utils";
    import BeatmapList from "../beatmap-list.svelte";
    import { show_context_menu } from "../../lib/store/context-menu";

    const FILTER_TYPES = [...DEFAULT_SORT_OPTIONS, "length"];
    const STATUS_TYPES = [ALL_STATUS_KEY, ...DEFAULT_STATUS_TYPES];

    const list = get_beatmap_list("collections");
    const popup_manager = get_popup_manager("collections");

    const { sort, query, status, show_invalid, difficulty_range } = list;

    $: filtered_collections = collections.collections;
    $: selected_collection = collections.selected;
    $: collection_search = collections.query;
    $: all_collections = collections.all_collections;
    $: should_update = collections.needs_update;
    $: pending_collections = collections.pending_collections;

    const filter_beatmaps = debounce(async () => {
        // only filter if we selected something
        if (!string_is_valid($selected_collection.name)) {
            return;
        }

        list.target.set($selected_collection.name);

        const result = await list.search();
        const hashes: Set<string> = new Set();

        for (const beatmap of result.beatmaps) {
            hashes.add(beatmap.md5);
        }

        if ($show_invalid) {
            for (const hash of result.invalid) {
                hashes.add(hash);
            }
        }

        if (result) {
            list.set_items(Array.from(hashes.values()), $query, false);
            list.update_list_id($selected_collection.name);
        }

        list.clear_multi_selected();
    }, 10);

    const update_sr = async (data: StarRatingFilter) => {
        list.set_difficulty_range(data);
        filter_beatmaps();
    };

    const remove_callback = async (hash: string) => {
        if ($selected_collection.name) {
            await remove_beatmap(hash, $selected_collection.name);

            const current_items = list.get_items();
            const new_items = current_items.filter((h) => h != hash);
            list.set_items(new_items, $query, false);
        }

        collections.filter();
    };

    const get_collections_options = () => {
        return [{ id: "empty", text: "create collection" }];
    };

    const get_collection_options = (collection) => {
        return [
            { id: "merge", text: "merge collections" },
            { id: `rename${context_separator}${collection.name}`, text: "rename collection" },
            { id: `export${context_separator}${collection.name}`, text: "export collections" },
            { id: "export beatmaps", text: "export beatmaps" },
            { id: `delete${context_separator}${collection.name}`, text: "delete" }
        ];
    };

    /* --- HANDLERS --- */

    const handle_merge_collections = (data) => {
        if (data.collections.length < 2) {
            show_notification({ type: "error", text: "you need at least 2 or more collections my guy" });
            return;
        }

        if (data.name == "") {
            show_notification({ type: "error", text: "wheres the name bro" });
            return;
        }

        if (collections.get(data.name)) {
            show_notification({ type: "error", text: "this collection already exists!" });
            return;
        }

        const beatmaps: Set<string> = new Set();

        for (const name of data.collections) {
            const collection = collections.get(name);
            if (collection) {
                collection.beatmaps.map((h) => beatmaps.add(h));
            }
        }

        const new_beatmaps = Array.from(beatmaps.values());
        collections.add({ name: data.name, beatmaps: new_beatmaps });
    };

    const handle_collections_menu = async (item) => {
        const id = item.id;

        switch (id) {
            case "empty":
                show_popup("empty", "collections");
                break;
            default:
                break;
        }
    };

    const handle_collection_menu = async (item) => {
        const id_parts = item.id.split(context_separator);
        const type = id_parts[0];

        switch (type) {
            case "merge":
                show_popup("merge", "collections");
                break;
            case "rename":
                enable_edit_mode(id_parts[1]);
                break;
            case "delete":
                collections.remove(id_parts[1]);
                break;
            case "export":
                show_popup("export", "collections");
                break;
            case "export beatmaps":
                show_popup("export-beatmaps", "collections");
                break;
        }
    };

    const handle_from_osu_collector = async (data) => {
        const { collection_url: url, name: custom_name } = data;

        if (url == "") {
            return;
        }

        const collection_data = await get_from_osu_collector(url);

        if (!collection_data.success) {
            show_notification({ type: "error", text: "failed to get collection: " + url });
            return;
        }

        const { name, beatmaps, checksums } = collection_data.data;
        const new_name = string_is_valid(custom_name) ? custom_name : name;

        if (collections.get(new_name)) {
            show_notification({ type: "warning", text: new_name + " already exists!" });
            return;
        }

        // temp add to osu beatmaps store
        for (const beatmap of beatmaps) {
            cached_beatmaps.set(beatmap.md5, beatmap);
        }

        collections.add({ name: new_name, beatmaps: checksums });

        // check for missing beatmaps
        await get_missing_beatmaps();

        show_notification({ type: "success", text: "added " + new_name });
    };

    const enable_edit_mode = (name: string) => {
        // get selected collection from context menu
        const collection = collections.get(name);

        if (!collection) {
            show_notification({ type: "error", text: "failed to get collection" });
            return;
        }

        // update item
        collection.edit = true;
        collections.replace(collection, true);
    };

    const handle_rename_collection = async (old_name: string, new_name: string) => {
        // get selected collection from context menu
        const collection = collections.get(old_name);

        if (!collection) {
            show_notification({ type: "error", text: "failed to get collection" });
            return;
        }

        if (old_name == new_name) {
            collection.edit = false;
            collections.replace(collection, true);
            return;
        }

        const result = await collections.rename(old_name, new_name);

        if (!result) {
            show_notification({ type: "error", text: "failed to rename collection" });
        }
    };

    const handle_legacy_import = async (location: string): Promise<boolean> => {
        const result = await get_legacy_collection_data(location);

        // TOFIX: why cant i access reason?
        if (!result.success) {
            //console.error(result.reason);
            return false;
        }

        for (const [_, collection] of result.data) {
            collections.add_pending({ ...collection, edit: false });
        }

        return true;
    };

    const handle_osdb_import = async (location: string): Promise<boolean> => {
        const result = await get_osdb_data(location);

        // TOFIX: why cant i access reason?
        if (!result.success) {
            //console.error(result.reason);
            return false;
        }

        for (const collection of result.data.collections) {
            collections.add_pending({
                name: collection.name,
                beatmaps: collection.hash_only_beatmaps,
                edit: false
            });
        }

        return true;
    };

    const handle_import_collections = async (data) => {
        // cancelled?
        if (!data.location || data.location == "") {
            return;
        }

        // get file type
        const splitted = data.location.split(".");
        const type = splitted[splitted.length - 1];

        if (type != "db" && type != "osdb") {
            show_notification({ type: "error", text: "please use a valid collection file (.db or .osdb)" });
            return;
        }

        switch (type) {
            case "db": {
                const result = await handle_legacy_import(data.location as string);
                if (!result) {
                    show_notification({ type: "error", text: "failed to import legacy collection..." });
                    return;
                }
                break;
            }
            case "osdb":
                const result = await handle_osdb_import(data.location as string);
                if (!result) {
                    show_notification({ type: "error", text: "failed to import osdb collection..." });
                    return;
                }
                break;
            default:
                show_notification({ type: "error", text: "please use a valid collection file (.db or .osdb)" });
                return;
        }

        show_popup("add-pending", "collections");
    };

    const handle_pending_collections = async (data) => {
        if (data.collections.length == 0) {
            return;
        }

        // loop through each collection from pending (from the previous file on the previous popup)
        for (const collection of $pending_collections) {
            // check if we selected it on this popup
            if (!data.collections.includes(collection.name)) {
                continue;
            }

            // dont add collection that already exists
            if (collections.get(collection.name)) {
                show_notification({ type: "error", text: `failed to add ${collection.name} (already exists)` });
                continue;
            }

            collections.add(collection);

            show_notification({ type: "success", text: `added ${collection.name}` });
        }
    };

    const handle_export_collections = async (data) => {
        const to_export: ICollectionResult[] = [];

        for (const name of data.collections) {
            const target = collections.get(name);

            if (target) {
                to_export.push(target);
            }
        }

        // TODO: generic result
        const result = await export_collections(to_export, data.type);

        if (!result) {
            show_notification({ type: "error", text: "failed to export" });
            return;
        }

        show_notification({ type: "success", text: `exported to ${config.get("export_path")}` });
    };

    const handle_export_beatmaps = async (data) => {
        if (!data.collections || data.collections.length == 0) return;

        const result = await export_beatmaps(data.collections);

        if (!result.success) {
            // NOTE: FUCK SVELTE
            show_notification({ type: "error", text: (result as any).reason || "failed to export beatmaps" });
            return;
        }

        show_notification({ type: "success", text: `exported ${result.data ?? 0} beatmaps to ${config.get("export_path")}` });
    };

    const handle_from_player = async (data) => {
        if (data.beatmap_options.length == 0) {
            show_notification({ type: "error", text: "no options selected for player" });
            return;
        }

        const joined_options = data.beatmap_options.join(", ");
        const joined_status = data.beatmap_status.join(", ");

        // rename some properties
        data.player_name = data.name;

        // func needs a Set instead of array
        data.beatmap_options = new Set(data.beatmap_options);
        data.beatmap_status = new Set(data.beatmap_status);

        const result = await get_player_data(data);

        if (!result) {
            return;
        }

        if (result.maps.length == 0) {
            show_notification({ type: "error", text: "found 0 beatmaps lol" });
            return;
        }

        // get hash list
        const hashes = result.maps.map((b) => b.md5).filter((b) => b != undefined);

        // // temp add to osu beatmaps store
        // for (const beatmap of result.maps) {
        //     cached_beatmaps.set(beatmap.md5, { beatmap });
        // }

        // create collection name (64 max chars)
        const collection_name = `${data.name} - ${joined_options} (${joined_status})`.substring(0, 64);

        // add new collection
        collections.add({ name: collection_name, beatmaps: hashes });

        show_notification({ type: "success", text: "added " + collection_name });

        // check for missing beatmaps
        await get_missing_beatmaps();
    };

    const handle_new_collection_popup = (data) => {
        const type = data.collection_type;

        if (type == "") {
            show_notification({ type: "error", text: "please select a collection type bro" });
            return;
        }

        if (data.name == "" && type == "from player") {
            show_notification({ type: "error", text: "forgot the collection name huh?" });
            return;
        }

        if (type == "file") {
            handle_import_collections(data);
        } else if (type == "osu! collector") {
            handle_from_osu_collector(data);
        } else if (type == "player") {
            handle_from_player(data);
        }
    };

    /* --- POPUP FUNCTIONS --- */

    // TODO: use collection-card buttons_type so i can show the ammount of beatmaps
    const create_pending_collection_select = async () => {
        const builder = new PopupBuilder();

        builder.add_buttons(
            "collections",
            "collections to import",
            $pending_collections?.map((c) => text_to_data(c.name)),
            { multiple: true }
        );

        builder.set_callback(handle_pending_collections);

        popup_manager.register("add-pending", builder.build());
    };

    const create_export_collections_popup = async () => {
        const builder = new PopupBuilder();

        builder.add_buttons(
            "collections",
            "collections",
            $all_collections.map((c) => text_to_data(c.name)),
            { multiple: true }
        );

        builder.add_dropdown(
            "type",
            "collection type",
            ["db", "osdb"].map((v) => text_to_data(v)),
            { value: "db" }
        );

        builder.set_callback(handle_export_collections);
        popup_manager.register("export", builder.build());
    };

    const create_export_beatmaps_popup = async () => {
        const builder = new PopupBuilder();

        builder.add_buttons(
            "collections",
            "collections",
            $all_collections.map((c) => text_to_data(c.name)),
            { multiple: true }
        );
        builder.set_callback(handle_export_beatmaps);
        popup_manager.register("export-beatmaps", builder.build());
    };

    const create_merge_collections_popup = () => {
        const builder = new PopupBuilder();

        builder.add_input("name", "name");
        builder.add_buttons(
            "collections",
            "collections to merge",
            $all_collections.map((c) => text_to_data(c.name)),
            { multiple: true }
        );

        builder.set_callback(handle_merge_collections);
        popup_manager.register("merge", builder.build());
    };

    const create_empty_collection_popup = () => {
        const builder = new PopupBuilder();

        builder.add_input("name", "name", { value: "" });
        builder.set_callback((data) => {
            collections.add({ name: data.name, beatmaps: [] });
        });

        popup_manager.register("empty", builder.build());
    };

    const create_new_collection_popup = () => {
        const builder = new PopupBuilder();

        // collection name / player name
        builder.add_input("name", "name", { value: "", show_when: { id: "collection_type", not_equals: "from file" } });

        // player options container
        builder.add_container("player_container", {
            label: "player options",
            show_when: [{ id: "collection_type", equals: "player" }]
        });

        // import collections container
        builder.add_container("import_container", {
            label: "import options",
            show_when: [{ id: "collection_type", equals: "file" }]
        });

        // osu! collector container
        builder.add_container("collector_container", {
            label: "collector options",
            show_when: [{ id: "collection_type", equals: "osu! collector" }]
        });

        // file dialog
        builder.add_file_dialog("location", "collection file", { parent: "import_container" });

        const beatmap_options = ["best performance", "first place", "favourites", "created maps"];

        // player options
        builder.add_buttons(
            "beatmap_options",
            "beatmap options",
            beatmap_options.map((o) => text_to_data(o)),
            {
                parent: "player_container",
                class: "row",
                multiple: true
            }
        );

        const removed_status = ["all", "unknown", "unsubmitted", "unused"];
        const filtered_status = Object.keys(BeatmapStatus)
            .filter((k) => isNaN(Number(k)))
            .filter((v) => !removed_status.includes(v.toLowerCase()));

        // beatmap status
        builder.add_buttons(
            "beatmap_status",
            "beatmap status",
            filtered_status.map((s) => text_to_data(s)),
            {
                parent: "player_container",
                class: "row",
                multiple: true
            }
        );

        // beatmap star rating
        builder.add_range("star_rating", "sr range", 0, 10, { parent: "player_container" });

        // osu! collector options
        builder.add_input("collection_url", "url", { value: "", parent: "collector_container" });

        const collection_types = ["player", "osu! collector", "file"];

        builder.add_dropdown(
            "collection_type",
            "from",
            collection_types.map((t) => text_to_data(t)),
            { value: "osu! collector" }
        );

        builder.set_callback(handle_new_collection_popup);
        popup_manager.register("new", builder.build());
    };

    // update collection object on query or when we update something from the collections object
    $: if ($collection_search != undefined || $all_collections) {
        collections.filter();
    }

    $: if ($selected_collection.name != undefined && ($query || $sort || $status || $show_invalid || $difficulty_range)) {
        filter_beatmaps();
    }

    onMount(() => {
        // "artist" as default sort
        if (!$sort) $sort = "artist";

        // setup popups
        create_pending_collection_select();
        create_empty_collection_popup();
        create_new_collection_popup();
        create_merge_collections_popup();
        create_export_collections_popup();
        create_export_beatmaps_popup();
    });
</script>

<div class="content tab-content">
    <!-- more options -->
    <Add callback={() => show_popup("new", "collections")} />
    <Popup key="collections" />
    <div class="sidebar">
        <div class="sidebar-header">
            <Search bind:value={$collection_search} placeholder="search collections" />
            {#if $should_update}
                <button class="update-btn" onclick={() => collections.update()}>update</button>
            {/if}
        </div>
        <div
            class="collections"
            role="button"
            tabindex="0"
            oncontextmenu={(e) => show_context_menu(e, get_collections_options(), handle_collections_menu)}
        >
            <!-- show collections -->
            {#if $filtered_collections.length == 0}
                <p>{$filtered_collections.length} results</p>
            {:else}
                {#each $filtered_collections as collection}
                    <div
                        role="button"
                        tabindex="0"
                        oncontextmenu={(e) => show_context_menu(e, get_collection_options(collection), handle_collection_menu)}
                    >
                        <CollectionCard
                            name={collection.name}
                            count={collection.beatmaps.length ?? 0}
                            edit={collection.edit}
                            selected={$selected_collection?.name == collection.name}
                            on_select={() => collections.select(collection.name, false)}
                            on_rename={(old_name, new_name) => handle_rename_collection(old_name, new_name)}
                        />
                    </div>
                {/each}
            {/if}
        </div>
    </div>
    <div class="manager-content">
        <div class="content-header">
            <!-- current beatmap search -->
            <Search bind:value={$query} placeholder="search beatmaps" />
            <ExpandableMenu>
                <Dropdown placeholder={"sort by"} bind:selected_value={$sort} options={FILTER_TYPES.map((t) => ({ label: t, value: t }))} />
                <Dropdown placeholder={"status"} bind:selected_value={$status} options={STATUS_TYPES.map((t) => ({ label: t, value: t }))} />
                <Checkbox bind:value={$show_invalid} label={"show missing beatmaps"} />
                <RangeSlider on_update={update_sr} />
            </ExpandableMenu>
        </div>

        <!-- render beatmap list -->
        <!-- TODO: show_missing, etc... -->
        <BeatmapList carousel={true} list_manager={list} on_remove={remove_callback} />
    </div>
</div>

<style>
    :global(.collections) {
        flex: 1;
        overflow-y: auto;
        padding: 0 10px 70px 10px;
        height: 100%;
    }

    :global(.collections p) {
        text-align: center;
    }

    .update-btn {
        background: var(--accent-color);
        border: none;
    }

    .update-btn:hover {
        border: none;
        transform: scale(1.02);
    }
</style>
