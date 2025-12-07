<script lang="ts">
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { show_notification } from "../../../lib/store/notifications";
    import CollectionCard from "../../cards/collection-card.svelte";

    let selected_collections: string[] = [];

    $: pending_collections = collections.pending_collections;

    const on_submit = async () => {
        if (selected_collections.length == 0) {
            return;
        }

        // loop through each collection from pending (from the previous file on the previous popup)
        for await (const collection of $pending_collections) {
            // check if we selected it on this popup
            if (!selected_collections.includes(collection.name)) {
                continue;
            }

            // dont add collection that already exists
            if (collections.get(collection.name)) {
                show_notification({ type: "error", text: `failed to add ${collection.name} (already exists)` });
                continue;
            }

            const create_result = await collections.create_collection(collection.name);

            if (!create_result) {
                return;
            }

            await collections.add_beatmaps(collection.name, collection.beatmaps);
        }

        cleanup();
    };

    const toggle_selection = (name: string) => {
        if (selected_collections.includes(name)) {
            selected_collections = selected_collections.filter((c) => c != name);
        } else {
            selected_collections = [...selected_collections, name];
        }
    };

    const cleanup = () => {
        selected_collections = [];
        pending_collections.set([]);
        show_modal(ModalType.none);
    };
</script>

{#if $current_modal == ModalType.get_pending_collections}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <h1 class="field-label">collections to import</h1>
            <div class="collection-list">
                {#each $pending_collections as collection}
                    <CollectionCard
                        name={collection.name}
                        count={collection.beatmaps.length}
                        selected={selected_collections.includes(collection.name)}
                        on_select={() => toggle_selection(collection.name)}
                    />
                {/each}
            </div>

            <div class="actions actions-separator">
                <button onclick={on_submit}>import</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .collection-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        max-height: 400px;
        overflow-y: auto;
        padding-right: 5px;
    }
</style>
