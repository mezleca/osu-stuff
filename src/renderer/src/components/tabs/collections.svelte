<script>
    import { collections } from "../../lib/store/collections";
    import { ALL_STATUS_KEY, DEFAULT_SORT_OPTIONS, DEFAULT_STATUS_TYPES } from "../../lib/store/other";
    import { get_beatmap_list, osu_beatmaps } from "../../lib/store/beatmaps";
    import { onMount } from "svelte";
    import { add_new_popup, show_popup, PopupAddon } from "../../lib/store/popup";
    import { ContextMenu } from "wx-svelte-menu";

    // components
    import Add from "../utils/add.svelte";
    import Search from "../utils/basic/search.svelte";
    import CollectionCard from "../cards/collection-card.svelte";
    import Beatmaps from "../beatmaps.svelte";
    import Popup from "../utils/popup.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import RangeSlider from "../utils/basic/range-slider.svelte";
    import Checkbox from "../utils/basic/checkbox.svelte";
    import { show_notification } from "../../lib/store/notifications";
    import { get_from_osu_collector } from "../../lib/utils/collections";

    let filtered_collections = [];

    const FILTER_TYPES = [...DEFAULT_SORT_OPTIONS, "length"];
    const STATUS_TYPES = [ALL_STATUS_KEY, ...DEFAULT_STATUS_TYPES];

    const list = get_beatmap_list("collections");
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
        const current_name = collection.name;
        const to_merge = $all_collections
            .filter((c) => c.name != current_name && c.maps.length > 0)
            .map((c) => ({ id: `merge-${c.name}-${current_name}`, text: c.name }));

        return [
            { id: "merge", text: "merge with >", data: to_merge },
            { id: "missing", text: "get missing beatmaps" },
            { id: "rename", text: "rename collection" },
            { id: "export", text: "export collection" },
            { id: "export_beatmap", text: "export beatmaps" },
            { id: `delete-${current_name}`, text: "delete" }
        ];
    };

    // @TODO: surly theres better ways to do this
    const handle_context_menu = (event) => {
        const type = event.action?.id;

        if (!type) {
            return;
        }

        // handle the rest
        switch (type) {
            case "rename":
                console.log("TODO");
                break;
            case "missing":
                console.log("TODO");
                break;
            case "export":
                console.log("TODO");
                break;
            case "export_beatmap":
                console.log("TODO");
                break;
            default: {
                const [custom_type, a, b] = type.split("-");
                if (custom_type == "delete") {
                    collections.remove(a);
                } else {
                    console.log("MERGE TODO");
                }
                break;
            }
        }
    };

    const handle_from_osu_collector = async (url, custom_name) => {
        if (url == "") {
            return;
        }

        const data = await get_from_osu_collector(url);

        if (!data) {
            show_notification({ type: "error", text: "failed to get collection: " + url });
            return;
        }

        const { name, beatmaps } = data;

        if (collections.get(name)) {
            show_notification({ type: "warning", text: name + " already exists!" });
            return;
        }

        const md5_hashes = [];

        // temp add to osu beatmaps store
        for (const beatmap of beatmaps) {
            osu_beatmaps.add(beatmap.md5, beatmap);
            md5_hashes.push(beatmap.md5);
        }

        collections.add({ name, maps: md5_hashes });
    };

    const handle_from_player = async (name, status, type) => {
        console.log("TODO");
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

    const create_new_collection_popup = () => {
        const addon = new PopupAddon();

        addon.add({ id: "name", type: "input", label: "name", active: () => ({ id: "collection_type", except: "from osu! collector" }) });

        // collection type (player / osu! collector)
        addon.add({
            id: "collection_type",
            type: "dropdown",
            label: "collection type",
            text: "select collection type",
            data: ["from player", "from osu! collector"],
            active: () => ({ id: "empty_collection", value: false })
        });

        // player options container
        addon.add({
            id: "player_container",
            type: "container",
            active: () => ({ id: "collection_type", value: "from player" })
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
            active: () => ({ id: "collection_type", value: "from osu! collector" })
        });

        // osu! collector options
        addon.add({
            id: "collection_url",
            type: "input",
            label: "url",
            parent: "collector_container"
        });

        // empty collection toggle
        addon.add({ id: "empty_collection", type: "checkbox", label: "empty collection", value: true });

        addon.set_callback(handle_new_collection_popup);
        add_new_popup("new collection", addon, "collections");
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
                            selected={$selected_collection?.name == collection.name}
                            callback={() => collections.select(collection.name)}
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
