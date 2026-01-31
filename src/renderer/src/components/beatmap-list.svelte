<script lang="ts">
    import type { BeatmapList } from "../lib/store/beatmaps";
    import { modals, ModalType } from "../lib/utils/modal";
    import { input } from "../lib/store/input";

    import VirtualList from "./utils/virtual-list.svelte";
    import BeatmapCard from "./cards/beatmap-card.svelte";
    import { onMount } from "svelte";

    export let list_manager: BeatmapList;
    export let height = 100;
    export let carousel = true;
    export let max_card_width = false;
    export let simplified = false;
    export let direction: "left" | "right" = "right";
    export let on_update: (index: number) => any = null;
    export let on_remove: (checksum: string) => any = null;
    export let show_missing = false;

    const items = list_manager.items;
    const selected = list_manager.selected;
    const selected_buffer = list_manager.selected_buffer;
    const list_id = list_manager.list_id;
    const total_missing = list_manager.total_missing;

    const handle_card_click = (event: MouseEvent, hash: string, index: number) => {
        const is_selected = $selected?.md5 == hash;

        if (event.ctrlKey) {
            list_manager.multi_select([hash]);
        } else {
            list_manager.clear_selected_buffer();
            if (is_selected) {
                list_manager.clear_selected();
            } else {
                list_manager.select(hash, index);
            }
        }
    };

    onMount(() => {
        input.on("escape", () => {
            // order: multi selection -> selection
            if (list_manager.get_selected_buffer().length > 0) {
                list_manager.clear_selected_buffer();
            } else if (list_manager.selected) {
                list_manager.clear_selected();
            }
        });

        return () => {
            input.unregister("escape");
        };
    });
</script>

<div class="beatmap-list-container">
    <!-- render beatmap matches-->
    <div class="beatmaps-header">
        <div class="results-count">{$items?.length ?? 0} beatmaps</div>
        {#if show_missing && $total_missing > 0}
            <button class="missing-button" onclick={() => modals.show(ModalType.missing_beatmaps)}> missing maps </button>
        {/if}
    </div>

    <!-- render beatmaps list-->
    <VirtualList
        key={$list_id}
        items={$items}
        count={$items?.length ?? 0}
        height="100%"
        item_height={height}
        max_width={max_card_width}
        {carousel}
        {direction}
        {on_update}
        selected={$selected?.index ?? -1}
        let:index
    >
        <!-- get current md5 hash -->
        {@const hash = $items[index]}
        {@const is_selected = hash && $selected?.index != -1 ? $selected?.md5 == hash : false}
        {@const is_highlighted = hash && $selected_buffer.length > 0 ? $selected_buffer.includes(hash) : false}

        <!-- render beatmap card -->
        <BeatmapCard
            selected={is_selected}
            highlighted={is_highlighted}
            show_remove={!simplified}
            show_bpm={!simplified}
            show_star_rating={!simplified}
            show_status={!simplified}
            centered={simplified}
            {on_remove}
            {hash}
            {height}
            on_click={(event) => handle_card_click(event, hash, index)}
        />
    </VirtualList>
</div>

<style>
    .beatmap-list-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0 20px;
    }

    .beatmaps-header {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
    }
</style>
