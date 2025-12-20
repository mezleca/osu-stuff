<script lang="ts">
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { export_beatmaps } from "../../../lib/utils/collections";
    import { config } from "../../../lib/store/config";
    import { cancel_export } from "../../../lib/store/export_progress";

    // components
    import Spinner from "../../icon/spinner.svelte";
    import CollectionCard from "../../cards/collection-card.svelte";

    let { is_exporting } = config;
    let selected_collections: string[] = [];

    $: all_collections = collections.all_collections;

    const on_submit = async () => {
        if (selected_collections.length == 0) {
            return;
        }

        export_beatmaps(selected_collections);
    };

    const on_cancel = () => {
        cancel_export();
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
        show_modal(ModalType.none);
    };
</script>

{#if $current_modal == ModalType.export_beatmaps}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            {#if $is_exporting}
                <div class="exporting-overlay">
                    <Spinner />
                    <div class="exporting-info">
                        <span>exporting beatmaps...</span>
                        <span class="helper-text">(you can close this window)</span>
                    </div>
                    <button class="cancel-btn" onclick={on_cancel}>cancel export</button>
                </div>
            {:else}
                <h1 class="field-label">export from:</h1>
                <div class="collection-list">
                    {#each $all_collections as collection}
                        <CollectionCard
                            name={collection.name}
                            count={collection.beatmaps.length}
                            selected={selected_collections.includes(collection.name)}
                            on_select={() => toggle_selection(collection.name)}
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
    .collection-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 400px;
        overflow-y: auto;
        padding-right: 8px;
        margin-bottom: 20px;
    }

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
