<script lang="ts">
    import { onMount } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import { modals, ModalType } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { export_beatmaps } from "../../../lib/utils/collections";
    import { core_state } from "../../../lib/store/other.svelte";
    import { stop_export } from "../../../lib/store/export_progress";

    import type { ExportEvent, ICollectionResult } from "@shared/types";

    // components
    import Spinner from "../../icon/spinner.svelte";
    import CollectionCard from "../../cards/collection-card.svelte";

    const EXPORT_ID = "export-beatmaps-modal";

    let selected_collections = new SvelteMap<string, ICollectionResult>();

    const all_collections = $derived(collections.all_collections);
    const has_modal = $derived($modals.has(ModalType.export_beatmaps));
    const is_exporting = $derived(core_state.export.is_exporting);

    const on_submit = async () => {
        if (selected_collections.size == 0) {
            return;
        }

        export_beatmaps({ id: EXPORT_ID, collections: Array.from(selected_collections.keys()) });
    };

    const cancel_export = () => {
        stop_export(EXPORT_ID);
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
        modals.hide(ModalType.export_beatmaps);
    };

    onMount(() => {
        return window.api.on("export:event", (event: ExportEvent) => {
            if (event.id == EXPORT_ID && event.type == "finished") {
                selected_collections.clear();
            }
        });
    });
</script>

{#if has_modal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            {#if is_exporting}
                <div class="exporting-overlay">
                    <Spinner />
                    <div class="exporting-info">
                        <span>exporting beatmaps...</span>
                        <span class="helper-text">(you can close this window)</span>
                    </div>
                    <button class="cancel-btn" onclick={cancel_export}>cancel export</button>
                </div>
            {:else}
                <h1 class="field-label">export from:</h1>
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
                    <button class="primary-btn" onclick={on_submit}>export</button>
                    <button onclick={cleanup}>close</button>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .exporting-overlay {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        padding: 40px 0;
    }

    .exporting-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        text-align: center;
    }

    .helper-text {
        font-size: 12px;
        opacity: 0.5;
    }

    .cancel-btn {
        margin-top: 10px;
        background: rgba(255, 64, 64, 0.1);
        color: #ff4040;
        border: 1px solid rgba(255, 64, 64, 0.2);
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: "Torus Bold";
    }

    .cancel-btn:hover {
        background: rgba(255, 64, 64, 0.2);
        transform: translateY(-1px);
    }
</style>
