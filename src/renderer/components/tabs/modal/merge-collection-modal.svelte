<script lang="ts">
    import { SvelteMap } from "svelte/reactivity";
    import { modals, ModalType } from "../../../lib/utils/modal";
    import { collection_manager } from "../../../lib/store/collections";
    import { show_notification } from "../../../lib/store/notifications";
    import Input from "../../utils/basic/input.svelte";
    import CollectionCard from "../../cards/collection-card.svelte";

    import type { ICollectionResult } from "@shared/types";

    let name = $state("");
    let selected_collections = new SvelteMap<string, ICollectionResult>();

    const all_collections = $derived(collection_manager.all_collections);
    const has_modal = $derived($modals.has(ModalType.merge_collection));

    const on_submit = async () => {
        if (selected_collections.size < 2) {
            show_notification({ type: "error", text: "you need at least 2 or more collections my guy" });
            return;
        }

        if (name == "") {
            show_notification({ type: "error", text: "wheres the name bro" });
            return;
        }

        if (collection_manager.get(name)) {
            show_notification({ type: "error", text: "this collection already exists!" });
            return;
        }

        const beatmaps: Set<string> = new Set();

        for (const collection of selected_collections.values()) {
            for (const hash of collection.beatmaps) {
                beatmaps.add(hash);
            }
        }

        const create_result = await collection_manager.create_collection(name);

        if (!create_result) {
            return;
        }

        show_notification({ type: "success", text: `created ${name}` });
        collection_manager.add_beatmaps(name, Array.from(beatmaps.values()));

        cleanup();
    };

    const toggle_selection = (collection: ICollectionResult) => {
        if (selected_collections.has(collection.name)) {
            selected_collections.delete(collection.name);
            return;
        }

        selected_collections.set(collection.name, collection);
    };

    const cleanup = () => {
        name = "";
        selected_collections.clear();
        modals.hide(ModalType.merge_collection);
    };
</script>

{#if has_modal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <Input label="name" bind:value={name} />

            <h1 class="field-label">collections to merge</h1>
            <div class="collection-list">
                {#each $all_collections as collection}
                    <CollectionCard
                        name={collection.name}
                        count={collection.beatmaps.length}
                        selected={selected_collections.has(collection.name)}
                        on_select={() => toggle_selection(collection)}
                    />
                {/each}
            </div>

            <div class="actions actions-separator">
                <button onclick={on_submit}>merge</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}
