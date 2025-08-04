<script>
    import { collections } from "../../lib/store/collections";
    import { get_from_osu_collector } from "../../lib/utils/collections";
    import { ALL_STATUS_KEY, DEFAULT_SORT_OPTIONS, DEFAULT_STATUS_TYPES } from "../../lib/store/other";
    import { get_beatmap_list, osu_beatmaps } from "../../lib/store/beatmaps";
    import { onMount } from "svelte";
    import { get_popup_manager, show_popup, PopupAddon } from "../../lib/store/popup";
    import { show_notification } from "../../lib/store/notifications";
    import { downloader } from "../../lib/store/downloader";
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
    const handle_context_menu = (event) => {
        const type = event.action?.id;

        if (!type) {
            return;
        }

        const splitted_shit = type.split("-");

        if (splitted_shit.length > 0) {
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
            case "missing":
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

    const handle_missing_beatmaps = async (data, missing_collections) => {
        const invalid = [];

        for (const missing of missing_collections) {
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
            show_notification({ type: "error", text: "failed to get collection "});
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
            show_notification({ type: "error", text: "failed to get collection "});
            return;
        }

        // update item
        collection.name = new_name;
        collection.edit = false;
        collections.replace(collection);
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

    /* --- POPUP FUNCTIONS --- */

    const create_missing_beatmaps_popup = async () => {
        const addon = new PopupAddon();
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

        addon.add({ id: "collections", type: "buttons", multiple: true, data: collections });
        addon.set_callback((data) => handle_missing_beatmaps(data, invalid_beatmaps));

        popup_manager.register("missing", addon);
    };

    const create_export_collections_popup = async () => {
        const addon = new PopupAddon();

        addon.add({ id: "collections", type: "buttons", label: "collections", data: $all_collections.map((c) => c.name) });
        addon.add({ id: "type", type: "dropdown", label: "collection type", data: ["legacy database (.db)", "osdb"]});

        addon.set_callback(handle_export_collections);

        popup_manager.register("export", addon);
    };

    const create_merge_collections_popup = () => {
        const addon = new PopupAddon();

        addon.add({ id: "name", type: "input", label: "name" });
        addon.add({ id: "collections", type: "buttons", multiple: true, data: $all_collections.map((c) => c.name) });

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

    // @TODO: this makes us request the collections every time we go into this tab
    // in collections theres no difference since the collections are usually small but on radio we can notice a small delay
    $: if ($selected_collection.name || $query || $sort || $status || $show_invalid) {
        filter_beatmaps();
    }

    onMount(() => {
        if ($sort == "") $sort = "artist";
        create_new_collection_popup();
        create_merge_collections_popup();
        create_missing_beatmaps_popup();
        create_export_collections_popup();
    });
</script>

<!-- @TODO: move css from app.cs to here -->
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
