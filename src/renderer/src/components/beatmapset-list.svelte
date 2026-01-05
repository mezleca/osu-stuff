<script lang="ts">
    import VirtualList from "./utils/virtual-list.svelte";
    import BeatmapSetCard from "./cards/beatmapset-card.svelte";
    import { modals, ModalType } from "../lib/utils/modal";
    import type { BeatmapSetList } from "../lib/store/beatmaps";

    // props
    export let list_manager: BeatmapSetList;
    export let width = "100%";
    export let height = 100;
    export let direction: "left" | "right" | "center" = "center";
    export let carousel = false;
    export let show_context = false;
    export let show_remove = false;
    export let on_update: (index: number) => void = null;
    export let show_missing = false;

    $: active_modals = $modals;

    const items = list_manager.items;
    const list_id = list_manager.list_id;
    const total_missing = list_manager.total_missing;
</script>

<div class="beatmapset-list-container" style="width: {width};">
    <!-- render beatmap matches-->
    <div class="beatmapsets-header">
        <div class="results-count">{$items?.length ?? 0} beatmapsets</div>
        {#if show_missing && $total_missing > 0}
            <button class="missing-button" onclick={() => active_modals.has(ModalType.missing_beatmaps)}> missing maps </button>
        {/if}
    </div>

    <!-- render beatmapsets list -->
    <VirtualList
        key={$list_id}
        count={$items?.length ?? 0}
        height={"100%"}
        item_height={height}
        buffer={5}
        columns={2}
        {carousel}
        {direction}
        {on_update}
        let:index
    >
        <!-- get current beatmapset id -->
        {@const id = $items[index]}

        <!-- render beatmapset card -->
        <BeatmapSetCard {id} {show_context} {show_remove} {height} {list_manager} />
    </VirtualList>
</div>

<style>
    .beatmapset-list-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0 20px;
    }

    .beatmapsets-header {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
    }
</style>
