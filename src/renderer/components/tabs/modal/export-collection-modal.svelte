<script lang="ts">
    import { SvelteMap } from "svelte/reactivity";
    import { modals, ModalType } from "../../../lib/utils/modal";
    import { collection_manager } from "../../../lib/store/collections";
    import { show_notification } from "../../../lib/store/notifications";
    import { export_collections } from "../../../lib/utils/collections";
    import { config } from "../../../lib/store/config";

    import type { ICollectionResult } from "@shared/types";

    // components
    import Dropdown from "../../utils/basic/dropdown.svelte";
    import CollectionCard from "../../cards/collection-card.svelte";

    let selected_collections = new SvelteMap<string, ICollectionResult>();
    let type = $state("db");

    const all_collections = $derived(collection_manager.all_collections);
    const has_modal = $derived($modals.has(ModalType.export_collection));

    const on_submit = async () => {
        if (selected_collections.size == 0) {
            show_notification({ type: "error", text: "select at least one collection" });
            return;
        }

        const selected_snapshot = $state.snapshot(Array.from(selected_collections.values()));
        const result = await export_collections(selected_snapshot, type);

        if (!result) {
            show_notification({ type: "error", text: "failed to export" });
            return;
        }

        show_notification({ type: "success", text: `exported to ${config.get("export_path")}` });
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
        selected_collections.clear();
        modals.hide(ModalType.export_collection);
    };
</script>

{#if has_modal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <h1 class="field-label">collections:</h1>

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

            <div class="options">
                <Dropdown
                    inline={false}
                    label="type"
                    bind:selected_value={type}
                    options={[
                        { label: "db", value: "db" },
                        { label: "osdb", value: "osdb" }
                    ]}
                />
            </div>

            <div class="actions actions-separator">
                <button class="primary-btn" onclick={on_submit}>export</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .options {
        margin-bottom: 20px;
    }
</style>
