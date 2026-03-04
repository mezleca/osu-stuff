<script lang="ts">
    import { onMount } from "svelte";
    import type { BeatmapList } from "../lib/store/beatmaps";
    import { modals, ModalType } from "../lib/utils/modal";
    import { input } from "../lib/store/input";
    import { is_typing } from "../lib/store/other";

    import VirtualList from "./utils/virtual-list.svelte";
    import BeatmapCard from "./cards/beatmap-card.svelte";
    import { ALL_BEATMAPS_KEY } from "@shared/types";

    export let list_manager: BeatmapList;
    export let height = 100;
    export let carousel = true;
    export let max_card_width = false;
    export let simplified = false;
    export let force_local_background = false;
    export let direction: "left" | "right" = "right";
    export let on_update: (index: number) => any = null;
    export let on_remove: (checksum: string) => any = null;
    export let on_remove_set: (id: number) => any = null;
    export let show_missing = false;

    const { items, target, selected, selected_buffer, id: list_id, total_missing } = list_manager;

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
        // remove selected beatmaps on scape
        // order: multi selection -> selection
        const handle_unselected_id = input.on("escape", () => {
            if (list_manager.get_selected_buffer().length > 0) {
                list_manager.clear_selected_buffer();
            } else if (list_manager.get_selected()) {
                list_manager.clear_selected();
            }
        });

        const handle_arrow_left_id = input.on("arrowleft", () => {
            if ($is_typing) {
                return;
            }

            const current_selected = list_manager.get_selected();

            if (!current_selected) {
                return;
            }

            const items = list_manager.get_items();
            const current_idx = current_selected.index;

            if (current_idx == 0) {
                return;
            }

            const next_idx = current_idx - 1;
            const hash = items[next_idx];

            if (!hash) {
                return;
            }

            list_manager.select(hash, next_idx);
        });

        const handle_arrow_right_id = input.on("arrowright", () => {
            if ($is_typing) {
                return;
            }

            const current_selected = list_manager.get_selected();

            if (!current_selected) {
                return;
            }

            const items = list_manager.get_items();
            const current_idx = current_selected.index;

            if (current_idx >= items.length - 1) {
                return;
            }

            const next_idx = current_idx + 1;
            const hash = items[next_idx];

            if (!hash) {
                return;
            }

            list_manager.select(hash, next_idx);
        });

        // select all beatmaps on ctrl + a
        const handle_select_all_id = input.on("control+a", () => {
            if ($is_typing) {
                return;
            }

            const items = list_manager.get_items();
            const items_size = items.length;

            let selected_size = list_manager.get_selected_buffer().length;

            if (list_manager.get_selected()) {
                selected_size++;
            }

            if (selected_size >= items_size) {
                return;
            }

            list_manager.selected_buffer.set(items);
        });

        return () => {
            input.unregister(handle_unselected_id);
            input.unregister(handle_select_all_id);
            input.unregister(handle_arrow_left_id);
            input.unregister(handle_arrow_right_id);
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
        selected_key={$selected?.md5 ?? null}
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
            show_context_remove={$target != ALL_BEATMAPS_KEY}
            {force_local_background}
            {on_remove}
            {on_remove_set}
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
