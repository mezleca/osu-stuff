<script>
    import { collections } from "../../lib/store/collections";
    import { get_from_osu_collector, get_db_data, get_osdb_data } from "../../lib/utils/collections";
    import { ALL_STATUS_KEY, DEFAULT_SORT_OPTIONS, DEFAULT_STATUS_TYPES } from "../../lib/store/other";
    import { get_beatmap_list, osu_beatmaps } from "../../lib/store/beatmaps";
    import { onMount } from "svelte";
    import { get_popup_manager, show_popup, PopupAddon } from "../../lib/store/popup";
    import { show_notification } from "../../lib/store/notifications";
    import { downloader } from "../../lib/store/downloader";
    import { convert_beatmap_keys } from "../../lib/utils/beatmaps";
    import { ContextMenu } from "wx-svelte-menu";

    // components
    import Add from "../utils/add.svelte";
    import Search from "../utils/basic/search.svelte";
    import CollectionCard from "../cards/collection-card.svelte";
    import Beatmaps from "../beatmaps.svelte";
    import Popup from "../utils/popup/popup.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import RangeSlider from "../utils/basic/range-slider.svelte";
    import Checkbox from "../utils/basic/checkbox.svelte";

    let filtered_collections = [];

    const FILTER_TYPES = [...DEFAULT_SORT_OPTIONS, "length"];
    const STATUS_TYPES = [ALL_STATUS_KEY, ...DEFAULT_STATUS_TYPES];

    const list = get_beatmap_list("collections");
    const popup_manager = get_popup_manager("collections");

    const { sort, query, status, show_invalid } = list;

    $: selected_collection = collections.selected;
    $: collection_search = collections.query;
    $: all_collections = collections.collections;
    $: should_update = collections.needs_update;
    $: pending_collections = collections.pending_collections;
    $: missing_beatmaps = collections.missing_beatmaps;
    $: missing_collections = collections.missing_collections;

    const filter_collection = () => {
        if ($collection_search == "") {
            filtered_collections = $all_collections;
        } else {
            filtered_collections = $all_collections.filter((obj) => obj.name.toLowerCase()?.includes($collection_search.toLowerCase()));
        }
    };

    const filter_beatmaps = async (extra) => {
        const result = await list.get_beatmaps($selected_collection.name, extra);
        list.set_beatmaps(result, $query, false);
    };

    // force list update
    const update_sr = async (data) => {
        list.update_range(data);
        filter_beatmaps();
    };

    const remove_callback = () => {
        if ($selected_collection.name) {
            filter_beatmaps();
        }
        filter_collection();
    };

    const get_context_options = (collection) => {
        return [
            { id: "merge", text: "merge collections" },
            { id: "missing", text: "get missing beatmaps" },
            { id: "import", text: "import collections" }, // @TODO: move to add-btn popup
            { id: `rename-${collection.name}`, text: "rename collection" },
            { id: `export-${collection.name}`, text: "export collection" },
            { id: "export beatmaps", text: "export beatmaps" },
            { id: `delete-${collection.name}`, text: "delete" }
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
            show_notification({ type: "alert", text: "this collection already exists!" });
            return;
        }

        const beatmaps = new Set();

        for (const name of data.collections) {
            const collection = collections.get(name);
            if (collection) {
                collection.maps.map((h) => beatmaps.add(h));
            }
        }

        const new_beatmaps = Array.from(beatmaps.values());
        collections.add({ name: data.name, maps: new_beatmaps });
    };

    // @TODO: surly theres better ways to do this
    const handle_context_menu = async (event) => {
        const type = event.action?.id;

        if (!type) {
            return;
        }

        const splitted_shit = type.split("-");

        if (splitted_shit.length > 1) {
            const custom_type = splitted_shit[0];
            switch (custom_type) {
                case "delete":
                    collections.remove(splitted_shit[1]);
                    break;
                case "rename":
                    enable_edit_mode(splitted_shit[1]);
                    break;
            }
        } else {
            // fallback to normal types
            switch (type) {
                case "merge":
                    show_popup("merge", "collections");
                    break;
                // @TODO: this should not be here, place it somewhere else later (add-btn popup)
                case "import":
                    show_popup("import", "collections");
                    break;
                case "missing":
                    await get_missing_beatmaps();
                    show_popup("missing", "collections");
                    break;
                case "export":
                    show_popup("export", "collections");
                    break;
                case "export beatmaps":
                    console.log("TODO");
                    break;
            }
        }
    };

    const handle_from_osu_collector = async (url) => {
        if (url == "") {
            return;
        }

        const data = await get_from_osu_collector(url);

        if (!data) {
            show_notification({ type: "error", text: "failed to get collection: " + url });
            return;
        }

        const { name, beatmaps, hashes } = data;

        if (collections.get(name)) {
            show_notification({ type: "warning", text: name + " already exists!" });
            return;
        }

        // temp add to osu beatmaps store
        for (const beatmap of beatmaps) {
            osu_beatmaps.add(beatmap.md5, beatmap);
        }

        collections.add({ name, maps: hashes });

        show_notification({ type: "success", text: "added " + name });
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

    const enable_edit_mode = (name) => {
        // get selected collection from context menu
        const collection = collections.get(name);

        if (!collection) {
            show_notification({ type: "error", text: "failed to get collection" });
            return;
        }

        // update item
        collection.edit = true;
        collections.replace(collection);
    };

    const handle_rename_collection = (old_name, new_name) => {
        // get selected collection from context menu
        const collection = collections.get(old_name);

        if (!collection) {
            show_notification({ type: "error", text: "failed to get collection" });
            return;
        }

        // update item
        collection.name = new_name;
        collection.edit = false;
        collections.replace(collection);
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

        const result = type == "db" ? await get_db_data(data.location) : await get_osdb_data(data.location);

        if (!result.success) {
            show_notification({ type: "error", text: result.reason });
            return;
        }

        // remove old pending
        if ($pending_collections.data != null) {
            collections.clear_pending();
        }

        $pending_collections = { type, data: type == "db" ? result.data : result.data.collections };
        show_popup("add-pending", "collections");
    };

    const handle_pending_collections = async (data) => {
        const type = $pending_collections.type;

        if (data.collections.length == 0 || !type) {
            return;
        }

        // loop through each collection from pending (from the previous file on the previous popup)
        for (const collection of $pending_collections.data) {
            // check if we selected it on this popup
            if (!data.collections.includes(collection.name)) {
                continue;
            }

            // dont add collection that already exists
            if (collections.get(collection.name)) {
                show_notification({ type: "error", text: `failed to add ${collection.name} (already exists)` });
                continue;
            }

            if (type == "osdb") {
                // osdb also saves information about beatmapsed_id, etc... but if the hashes are available, use them instead
                if (collection.hash_only_beatmaps.length != 0) {
                    collections.add({ name: collection.name, maps: collection.hash_only_beatmaps });
                } else {
                    const hashes = [];
                    // add each one of the beatmaps, one at... time... yes im retarded
                    for (const beatmap of collection.beatmaps) {
                        const map_already_exists = window.osu.get_beatmap_by_md5(beatmap.md5);

                        if (map_already_exists) {
                            hashes.push(beatmap.md5);
                            continue;
                        }

                        const converted = convert_beatmap_keys(beatmap);

                        converted.downloaded = false;
                        converted.local = true; // kinda forgot why i added this

                        // add beatmap to osu! data object (main process)
                        await window.osu.add_beatmap(converted.md5, converted);
                        hashes.push(converted.md5);
                    }
                    collections.add({ name: collection.name, maps: hashes });
                }
            } else {
                // just add :D
                collections.add(collection);
            }

            show_notification({ type: "success", text: `added ${collection.name}` });
        }
    };

    const handle_export_collections = async (data) => {
        console.log(data.collections, data.type);
    };

    const handle_from_player = async (data) => {
        console.log("TODO", data);
    };

    const handle_new_collection_popup = (data) => {
        if (data.name == "") {
            show_notification({ type: "error", text: "forgot the collection name huh?" });
            return;
        }

        if (data.empty_collection) {
            collections.add({ name: data.name, maps: [] });
            return;
        }

        const type = data.collection_type;

        if (type == "") {
            show_notification({ type: "error", text: "please select a collection type bro" });
            return;
        }

        if (type == "from osu! collector") {
            handle_from_osu_collector(data.collection_url);
        } else if (type == "from player") {
            handle_from_player(data.player_name, data.beatmap_status, data.beatmap_type);
        }
    };

    const get_missing_beatmaps = async () => {
        if ($missing_beatmaps.length != 0) {
            $missing_beatmaps = [];
        }

        if ($missing_collections.length != 0) {
            $missing_collections = [];
        }

        const collections = [],
            invalid_beatmaps = [];

        for (const collection of $all_collections) {
            // check if theres any missing beatmap on this collection
            const invalid = await window.osu.missing_beatmaps(collection.maps);

            if (invalid.length > 0) {
                collections.push(collection.name);
                invalid_beatmaps.push({ name: collection.name, beatmaps: invalid });
            }
        }

        $missing_beatmaps = invalid_beatmaps;
        $missing_collections = collections;
    };

    /* --- POPUP FUNCTIONS --- */

    const create_missing_beatmaps_popup = async () => {
        const addon = new PopupAddon();

        addon.add({ id: "collections", type: "buttons", label: "collections to download", multiple: true, data: () => $missing_collections });
        addon.set_callback(handle_missing_beatmaps);

        popup_manager.register("missing", addon);
    };

    const create_import_collections_popup = async () => {
        const addon = new PopupAddon();

        addon.add({ id: "location", type: "file-dialog", label: "collection file" });
        addon.set_callback(handle_import_collections);

        popup_manager.register("import", addon);
    };

    // @TODO: use collection-card buttons_type so i can show the ammount of beatmaps
    const create_pending_collection_select = async () => {
        const addon = new PopupAddon();

        addon.add({
            id: "collections",
            type: "buttons",
            multiple: true,
            label: "collections to import",
            data: () => $pending_collections?.data?.map((c) => c.name) ?? []
        });
        addon.set_callback(handle_pending_collections);

        popup_manager.register("add-pending", addon);
    };

    const create_export_collections_popup = async () => {
        const addon = new PopupAddon();

        addon.add({ id: "collections", type: "buttons", label: "collections", data: () => $all_collections.map((c) => c.name) });
        addon.add({ id: "type", type: "dropdown", label: "collection type", data: ["legacy database (.db)", "osdb"] });

        addon.set_callback(handle_export_collections);

        popup_manager.register("export", addon);
    };

    const create_merge_collections_popup = () => {
        const addon = new PopupAddon();

        addon.add({ id: "name", type: "input", label: "name" });
        addon.add({
            id: "collections",
            type: "buttons",
            label: "collections to merge",
            multiple: true,
            data: () => $all_collections.map((c) => c.name)
        });

        addon.set_callback(handle_merge_collections);
        popup_manager.register("merge", addon);
    };

    const create_new_collection_popup = () => {
        const addon = new PopupAddon();

        addon.add({ id: "name", type: "input", label: "name", show_when: { id: "collection_type", except: "from osu! collector" } });

        // collection type (player / osu! collector)
        addon.add({
            id: "collection_type",
            type: "dropdown",
            label: "collection type",
            text: "select collection type",
            data: ["from player", "from osu! collector"],
            show_when: { id: "empty_collection", equals: false }
        });

        // player options container
        addon.add({
            id: "player_container",
            type: "container",
            show_when: { id: "collection_type", equals: "from player" }
        });

        // player options
        addon.add({
            id: "player_name",
            type: "input",
            label: "player name",
            parent: "player_container"
        });

        addon.add({
            id: "beatmap_status",
            type: "dropdown",
            label: "status",
            text: "beatmap status",
            data: DEFAULT_STATUS_TYPES,
            parent: "player_container"
        });

        addon.add({
            id: "beatmap_type",
            type: "buttons",
            label: "beatmap type",
            data: ["created", "favorites", "best performance", "pinned"],
            parent: "player_container"
        });

        // osu! collector container
        addon.add({
            id: "collector_container",
            type: "container",
            show_when: { id: "collection_type", equals: "from osu! collector" }
        });

        // osu! collector options
        addon.add({
            id: "collection_url",
            type: "input",
            label: "url",
            parent: "collector_container"
        });

        // empty collection toggle
        addon.add({ id: "empty_collection", type: "checkbox", label: "empty collection", equals: true });

        addon.set_callback(handle_new_collection_popup);
        popup_manager.register("new collection", addon);
    };

    $: if ($all_collections || $collection_search) {
        filter_collection();
    }

    // @TODO: this makes us request the collection every time we go into this tab
    // for small collections this is not a big of a problem since the collections are usually small
    // but on radio we can notice a small delay since we're doing this 2 times
    $: if ($selected_collection.name || $query || $sort || $status || $show_invalid) {
        filter_beatmaps();
    }

    onMount(() => {
        if ($sort == "") $sort = "artist";
        create_pending_collection_select();
        create_new_collection_popup();
        create_merge_collections_popup();
        create_missing_beatmaps_popup();
        create_import_collections_popup();
        create_export_collections_popup();
    });
</script>

<div class="content tab-content">
    <!-- more options -->
    <Add callback={() => show_popup("new collection", "collections")} />
    <Popup key="collections" />
    <div class="sidebar">
        <div class="sidebar-header">
            <Search bind:value={$collection_search} placeholder="search collections" callback={filter_collection} />
            {#if $should_update}
                <button class="update-btn" onclick={() => collections.update()}>update</button>
            {/if}
        </div>
        <div class="collections">
            <!-- show collections -->
            {#if filtered_collections.length == 0}
                <p>{filtered_collections.length} results</p>
            {:else}
                {#each filtered_collections as collection}
                    <ContextMenu onclick={handle_context_menu} options={get_context_options(collection)} at="point">
                        <CollectionCard
                            name={collection.name}
                            count={collection.maps.length ?? 0}
                            edit={collection.edit}
                            selected={$selected_collection?.name == collection.name}
                            select_callback={() => collections.select(collection.name)}
                            rename_callback={(old_name, new_name) => handle_rename_collection(old_name, new_name)}
                        />
                    </ContextMenu>
                {/each}
            {/if}
        </div>
    </div>
    <div class="manager-content">
        <div class="content-header">
            <!-- current beatmap search -->
            <Search bind:value={$query} placeholder="search beatmaps" />
            <ExpandableMenu>
                <Dropdown placeholder={"sort by"} bind:selected_value={$sort} options={FILTER_TYPES} />
                <Dropdown placeholder={"status"} bind:selected_value={$status} options={STATUS_TYPES} />
                <Checkbox bind:value={$show_invalid} label={"show missing beatmaps"} />
                <RangeSlider on_update={update_sr} />
            </ExpandableMenu>
        </div>
        <!-- render beatmap list -->
        <Beatmaps carousel={true} tab_id={"collections"} {remove_callback} direction={"right"} />
    </div>
</div>

<style>
    .collections p {
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
