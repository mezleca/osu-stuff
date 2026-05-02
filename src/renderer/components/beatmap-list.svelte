<script lang="ts">
    import type { BeatmapList } from "../lib/store/beatmaps";
    import { onMount, tick } from "svelte";
    import {
        ALL_BEATMAPS_KEY,
        BEATMAP_CARD_ELEMENT,
        remove_flag,
        type BeatmapCardMode,
        type BeatmapCardElements,
        type VirtualListRef,
        has_flag
    } from "@shared/types";
    import { modals, ModalType } from "../lib/utils/modal";
    import { input } from "../lib/store/input";
    import { is_typing } from "../lib/store/other";

    import VirtualList from "./utils/virtual-list.svelte";
    import BeatmapCard from "./cards/beatmap-card.svelte";

    export let list_manager: BeatmapList;
    export let height = 100;
    export let carousel = true;
    export let max_card_width = false;
    export let mode: BeatmapCardMode = "card";
    export let elements: BeatmapCardElements = 0;
    export let direction: "left" | "right" = "right";
    export let on_update: (index: number) => any = null;
    export let on_remove: (checksum: string) => any = null;
    export let on_remove_set: (id: number) => any = null;
    export let show_missing = false;
    export let show_header = true;

    let virtual_ref: VirtualListRef | null = null;
    let final_card_elements: BeatmapCardElements = elements;

    const { items, target, selected_buffer, id: list_id, total_missing } = list_manager;

    $: selected = $selected_buffer[0];

    export const focus_selected = (force: boolean = false) => {
        if (!virtual_ref) {
            console.log("uhhh, wheres the virtual list ref bro");
            return;
        }

        virtual_ref.focus_selected(force);
    };

    export const get_total = (): number => {
        return list_manager.get_items().length;
    };

    const handle_card_click = async (event: MouseEvent, hash: string, index: number) => {
        const is_selected = selected?.id == hash;

        if (event.ctrlKey) {
            list_manager.multi_select([{ id: hash, index }]);
        } else {
            list_manager.clear_selected();

            if (is_selected) {
                list_manager.clear_selected();
            } else {
                list_manager.select({ id: hash, index });
                await tick();
                focus_selected(true);
            }
        }
    };

    $: {
        if ($target == ALL_BEATMAPS_KEY && has_flag(elements, BEATMAP_CARD_ELEMENT.CONTEXT_MENU_REMOVE)) {
            final_card_elements = remove_flag(elements, BEATMAP_CARD_ELEMENT.CONTEXT_MENU_REMOVE);
        } else {
            final_card_elements = elements;
        }
    }

    onMount(() => {
        const handle_unselected_id = input.on("escape", () => {
            list_manager.selected_buffer.update((current) => (current.length > 1 ? [current[0]] : []));
        });

        const handle_arrow_left_id = input.on("arrowleft", () => {
            if ($is_typing) {
                return;
            }

            if (!selected) {
                return;
            }

            const items = list_manager.get_items();
            const current_idx = selected.index;

            if (current_idx == 0) {
                return;
            }

            const next_idx = current_idx - 1;
            const id = items[next_idx];

            if (!id) {
                return;
            }

            list_manager.select({ id, index: next_idx });
        });

        const handle_arrow_right_id = input.on("arrowright", () => {
            if ($is_typing) {
                return;
            }

            if (!selected) {
                return;
            }

            const items = list_manager.get_items();
            const current_idx = selected.index;

            if (current_idx >= items.length - 1) {
                return;
            }

            const next_idx = current_idx + 1;
            const id = items[next_idx];

            if (!id) {
                return;
            }

            list_manager.select({ id, index: next_idx });
        });

        const handle_select_all_id = input.on("control+a", () => {
            if ($is_typing) {
                return;
            }

            const items = list_manager.get_items();
            const items_size = items.length;

            let selected_len = $selected_buffer.length;

            if (selected) {
                selected_len++;
            }

            if (selected_len >= items_size) {
                return;
            }

            list_manager.selected_buffer.set(items.map((id, index) => ({ id, index })));
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
    {#if show_header}
        <div class="beatmaps-header">
            <div class="results-count">{$items?.length ?? 0} beatmaps</div>
            {#if show_missing && $total_missing > 0}
                <button class="missing-button" onclick={() => modals.show(ModalType.missing_beatmaps)}> missing maps </button>
            {/if}
        </div>
    {/if}

    <VirtualList
        bind:this={virtual_ref}
        key={$list_id}
        items={$items}
        count={$items?.length ?? 0}
        height="100%"
        item_height={height}
        max_width={max_card_width}
        {carousel}
        {direction}
        {on_update}
        selected={selected?.index ?? -1}
        let:index
    >
        {@const hash = $items[index]}
        {@const is_selected = hash && selected?.index != -1 ? selected?.id == hash : false}
        {@const is_highlighted = hash && $selected_buffer.length > 0 ? $selected_buffer.some((s, idx) => idx > 0 && s.id == hash) : false}

        <BeatmapCard
            selected={is_selected}
            highlighted={is_highlighted}
            elements={final_card_elements}
            {mode}
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
        padding: 0 12px;
    }

    .beatmaps-header {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
    }
</style>
