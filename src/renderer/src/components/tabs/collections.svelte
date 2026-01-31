<script lang="ts">
    import { onMount } from "svelte";
    import { collections } from "../../lib/store/collections";
    import { FILTER_TYPES, STATUS_TYPES } from "../../lib/store/other";
    import { get_beatmap_list } from "../../lib/store/beatmaps";
    import { show_notification } from "../../lib/store/notifications";
    import { remove_beatmap } from "../../lib/utils/beatmaps";
    import { context_separator, string_is_valid } from "../../lib/utils/utils";
    import { debounce } from "../../lib/utils/timings";
    import { modals, ModalType } from "../../lib/utils/modal";
    import { show_context_menu } from "../../lib/store/context-menu";

    // components
    import Add from "../utils/add.svelte";
    import Search from "../utils/basic/search.svelte";
    import CollectionCard from "../cards/collection-card.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import RangeSlider from "../utils/basic/range-slider.svelte";
    import Checkbox from "../utils/basic/checkbox.svelte";

    import BeatmapList from "../beatmap-list.svelte";

    // modals
    import GetCollectionModal from "./modal/get-collection-modal.svelte";
    import MergeCollectionModal from "./modal/merge-collection-modal.svelte";
    import ExportCollectionModal from "./modal/export-collection-modal.svelte";
    import ExportBeatmapsModal from "./modal/export-beatmaps-modal.svelte";
    import EmptyCollectionModal from "./modal/empty-collection-modal.svelte";
    import QuickConfirmModal from "./modal/quick-confirm-modal.svelte";

    const list = get_beatmap_list("collections");

    const { sort, query, status, show_invalid, difficulty_range, should_update } = list;

    $: filtered_collections = collections.collections;
    $: selected_collection = collections.selected;
    $: collection_search = collections.query;
    $: all_collections = collections.all_collections;
    $: collection_should_update = collections.needs_update;

    const debounced_filter = debounce(async (force: boolean = false) => {
        // only filter if we selected something
        if (!string_is_valid($selected_collection.name)) {
            return;
        }

        list.target.set($selected_collection.name);

        const result = await list.search(force);
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

        list.clear_selected_buffer();
    }, 10);

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

    const handle_collections_menu = async (item) => {
        const id = item.id;

        switch (id) {
            case "empty":
                modals.show(ModalType.empty_collection);
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
                modals.show(ModalType.merge_collection);
                break;
            case "rename":
                enable_edit_mode(id_parts[1]);
                break;
            case "delete":
                collections.remove(id_parts[1]);
                break;
            case "export":
                modals.show(ModalType.export_collection);
                break;
            case "export beatmaps":
                modals.show(ModalType.export_beatmaps);
                break;
        }
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

    // update collection object on query or when we update something from the collections object
    $: if ($collection_search != undefined || $all_collections) {
        collections.filter();
    }

    $: if ($selected_collection.name != undefined && ($query || $sort || $status || $show_invalid || $difficulty_range || $should_update)) {
        debounced_filter($should_update);
    }

    onMount(() => {
        if (!$sort) $sort = "artist";

        if ($selected_collection.name && list.get_items().length == 0) {
            debounced_filter();
        }

        list.check_missing();

        return () => {
            debounced_filter.cancel();
        };
    });
</script>

<div class="content tab-content">
    <!-- more options -->
    <Add callback={() => modals.show(ModalType.get_collection)} />

    <GetCollectionModal />
    <MergeCollectionModal />
    <ExportCollectionModal />
    <ExportBeatmapsModal />
    <EmptyCollectionModal />
    <QuickConfirmModal />

    <div class="sidebar">
        <div class="sidebar-header">
            <Search bind:value={$collection_search} placeholder="search collections" />
            {#if $collection_should_update}
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
            <Search bind:value={$query} placeholder="search beatmaps" />
            <ExpandableMenu>
                <Dropdown label={"sort by"} bind:selected_value={$sort} options={FILTER_TYPES} />
                <Dropdown label={"status"} bind:selected_value={$status} options={STATUS_TYPES} />
                <Checkbox bind:value={$show_invalid} label={"show missing beatmaps"} />
                <RangeSlider min={0} max={10} bind:value={$difficulty_range} />
            </ExpandableMenu>
        </div>

        <!-- render beatmap list -->
        <BeatmapList carousel={true} list_manager={list} on_remove={remove_callback} show_missing={true} />
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
        font-family: "Torus SemiBold";
    }

    .update-btn:hover {
        border: none;
        transform: scale(1.02);
    }
</style>
