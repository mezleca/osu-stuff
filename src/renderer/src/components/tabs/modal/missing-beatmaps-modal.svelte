<script lang="ts">
    import { collections } from "../../../lib/store/collections";
    import { downloader } from "../../../lib/store/downloader";
    import { current_modal, ModalType } from "../../../lib/utils/modal";
    import { show_notification } from "../../../lib/store/notifications";

    import CollectionCard from "../../cards/collection-card.svelte";
    import Spinner from "../../icon/spinner.svelte";

    let missing_collections: { name: string; count: number }[] = [];
    let selected_collections: string[] = [];
    let loading = true;

    const fetch_missing = async () => {
        loading = true;
        try {
            missing_collections = await collections.get_missing();
        } catch (error) {
            console.error("[missing_beatmaps_modal] fetch error:", error);
            show_notification({ type: "error", text: "failed to fetch missing beatmaps" });
        } finally {
            loading = false;
        }
    };

    const toggle_selection = (name: string) => {
        if (selected_collections.includes(name)) {
            selected_collections = selected_collections.filter((c) => c != name);
        } else {
            selected_collections = [...selected_collections, name];
        }
    };

    const toggle_all = () => {
        if (selected_collections.length == missing_collections.length) {
            selected_collections = [];
        } else {
            selected_collections = missing_collections.map((c) => c.name);
        }
    };

    const handle_download = async () => {
        if (selected_collections.length == 0) {
            show_notification({ type: "warning", text: "select at least one collection" });
            return;
        }

        try {
            for (const name of selected_collections) {
                const missing_hashes = await window.api.invoke("driver:get_missing_beatmaps", name);

                if (!missing_hashes || missing_hashes.length == 0) {
                    continue;
                }

                const beatmaps = missing_hashes.map((md5) => ({ md5 }));

                await downloader.add({
                    id: `missing: ${name}`,
                    beatmaps
                });
            }

            show_notification({ type: "success", text: "downloads started" });
            cleanup();
        } catch (error) {
            console.error("[missing_beatmaps_modal] download error:", error);
            show_notification({ type: "error", text: "failed to start downloads" });
        }
    };

    const cleanup = () => {
        selected_collections = [];
        missing_collections = [];
        current_modal.set(ModalType.none);
    };

    $: if ($current_modal == ModalType.missing_beatmaps) {
        fetch_missing();
    }
</script>

{#if $current_modal == ModalType.missing_beatmaps}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" role="button" tabindex="0" onclick={cleanup} onkeydown={(e) => (e.key == "Enter" || e.key == " ") && cleanup()}>
        <div class="modal" role="dialog" aria-modal="true" tabindex="0" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h1 class="field-label">missing beatmaps</h1>
                {#if !loading && missing_collections.length > 0}
                    <button class="text-btn" onclick={toggle_all}>
                        {selected_collections.length == missing_collections.length ? "unselect all" : "select all"}
                    </button>
                {/if}
            </div>

            <div class="modal-content">
                {#if loading}
                    <div class="loading-state">
                        <Spinner />
                        <span>looking for missing maps...</span>
                    </div>
                {:else if missing_collections.length == 0}
                    <div class="empty-state">
                        <span>all beatmaps are present!</span>
                        <button class="primary-btn" onclick={cleanup}>great</button>
                    </div>
                {:else}
                    <div class="collection-list">
                        {#each missing_collections as collection}
                            <CollectionCard
                                name={collection.name}
                                count={collection.count}
                                selected={selected_collections.includes(collection.name)}
                                on_select={() => toggle_selection(collection.name)}
                            />
                        {/each}
                    </div>
                {/if}
            </div>

            {#if !loading && missing_collections.length > 0}
                <div class="modal-footer actions-separator">
                    <button class="primary-btn" onclick={handle_download}>
                        download ({selected_collections.length})
                    </button>
                    <button onclick={cleanup}>cancel</button>
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
    }
</style>
