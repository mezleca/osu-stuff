<script>
    import { collections, collection_search, selected_collection, selected_collection_name } from "../../lib/store/collections";
    import { ALL_STATUS_KEY, DEFAULT_SORT_OPTIONS, DEFAULT_STATUS_TYPES } from "../../lib/store/other";
    import { get_beatmap_list } from "../../lib/store/beatmaps";
    import { onMount } from "svelte";
    import { add_new_popup, show_popup, PopupAddon } from "../../lib/store/popup";
    import { ContextMenu } from "wx-svelte-menu";

    // components
    import Add from "../utils/add.svelte";
    import Search from "../utils/search.svelte";
    import CollectionCard from "../cards/collection-card.svelte";
    import Beatmaps from "../beatmaps.svelte";
    import Popup from "../utils/popup.svelte";
    import Dropdown from "../utils/dropdown.svelte";
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import RangeSlider from "../utils/range-slider.svelte";

    let filtered_collections = [];

    const FILTER_TYPES = [...DEFAULT_SORT_OPTIONS, "length"];
    const STATUS_TYPES = [ALL_STATUS_KEY, ...DEFAULT_STATUS_TYPES];

    const list = get_beatmap_list("collections");
    const { sort, query, status } = list;

    $: all_collections = collections.all;

    const filter_collection = () => {
        if ($collection_search == "") {
            filtered_collections = $all_collections;
        } else {
            filtered_collections = $all_collections.filter((obj) => obj.name.toLowerCase()?.includes($collection_search.toLowerCase()));
        }
    };

    const filter_beatmaps = async (extra) => {
        const result = await list.get_beatmaps($selected_collection_name, extra);
        list.set_beatmaps(result, $query, false);
    };

    // force list update
    const update_sr = async (data) => {
        list.update_range(data);
        filter_beatmaps();
    };

    const remove_callback = () => {
        if ($selected_collection_name) {
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
            { id: "delete", text: "delete" }
        ];
    };

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
            case "delete":
                console.log("TODO");
                break;
            default:
                type.split("-").splice(1);
                break;
        }
    };

    const handle_new_collection_popup = (data) => {
        console.log(data);
    };

    const create_new_collection_popup = () => {
        const new_mirror_popup = new PopupAddon();
        new_mirror_popup.add({ id: "method", type: "buttons", text: "method", multiple: false, data: ["empty", "custom"] });
        new_mirror_popup.set_callback(handle_new_collection_popup);

        add_new_popup("new collection", new_mirror_popup, "collections");
    };

    $: if ($collection_search) {
        filter_collection();
    }

    // @TODO: this makes us request the collections every time we go into this tab
    // in collections theres no difference since the collections are usually small but on radio we can notice a small delay
    $: if ($selected_collection_name || $query || $sort || $status) {
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
</style>
