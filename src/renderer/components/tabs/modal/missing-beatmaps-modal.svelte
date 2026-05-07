<script lang="ts">
    import { SvelteMap } from "svelte/reactivity";
    import { collections } from "../../../lib/store/collections";
    import { downloader } from "../../../lib/store/downloader";
    import { config } from "../../../lib/store/config";
    import { modals, ModalType } from "../../../lib/utils/modal";
    import { show_notification } from "../../../lib/store/notifications";

    const { mirrors } = config;

    import CollectionCard from "../../cards/collection-card.svelte";
    import Spinner from "../../icon/spinner.svelte";

    interface MissingCollection {
        name: string;
        count: number;
    }

    let missing_collections = $state<MissingCollection[]>([]);
    let selected_collections = new SvelteMap<string, MissingCollection>();
    let loading = $state(true);

    const has_modal = $derived($modals.has(ModalType.missing_beatmaps));
    const has_mirrors = $derived($mirrors.length > 0);

    // fetch missing beatmaps if modal is selected
    $effect(() => {
        if (has_modal) {
            loading = true;

            collections
                .get_missing()
                .then((result) => (missing_collections = result))
                .catch(() => show_notification({ type: "error", text: "failed to fetch missing beatmaps" }))
                .finally(() => (loading = false));
        }
    });

    const toggle_selection = (collection: MissingCollection) => {
        if (selected_collections.has(collection.name)) {
            selected_collections.delete(collection.name);
            return;
        }

        selected_collections.set(collection.name, collection);
    };

    const toggle_all = () => {
        if (selected_collections.size == missing_collections.length) {
            selected_collections.clear();
            return;
        }

        selected_collections.clear();

        for (const collection of missing_collections) {
            selected_collections.set(collection.name, collection);
        }
    };

    const handle_download = async () => {
        if (!has_mirrors) {
            show_notification({ type: "error", text: "no active mirrors configured. add one in config tab first" });
            return;
        }

        if (selected_collections.size == 0) {
            show_notification({ type: "warning", text: "select at least one collection" });
            return;
        }

        try {
            for (const collection of selected_collections.values()) {
                const missing_hashes = await window.api.invoke("client:get_missing_beatmaps", collection.name);

                if (!missing_hashes || missing_hashes.length == 0) {
                    continue;
                }

                const beatmaps: { md5: string }[] = [];

                for (const md5 of missing_hashes) {
                    beatmaps.push({ md5 });
                }

                await downloader.add({
                    id: `missing: ${collection.name}`,
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
        selected_collections.clear();
        missing_collections = [];
        modals.hide(ModalType.missing_beatmaps);
    };
</script>

{#if has_modal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" role="button" tabindex="0" onclick={cleanup} onkeydown={(e) => (e.key == "Enter" || e.key == " ") && cleanup()}>
        <div class="modal" role="dialog" aria-modal="true" tabindex="0" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h1 class="field-label">missing beatmaps</h1>
                {#if !loading && missing_collections.length > 0}
                    <button class="text-btn" onclick={toggle_all}>
                        {selected_collections.size == missing_collections.length ? "unselect all" : "select all"}
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
                                selected={selected_collections.has(collection.name)}
                                on_select={() => toggle_selection(collection)}
                            />
                        {/each}
                    </div>
                {/if}
            </div>

            {#if !loading && missing_collections.length > 0}
                <div class="modal-footer actions-separator">
                    <button class="primary-btn" onclick={handle_download} disabled={!has_mirrors}>
                        download ({selected_collections.size})
                    </button>
                    <button onclick={cleanup}>cancel</button>
                </div>
                {#if !has_mirrors}
                    <div class="mirror-warning">no active mirrors found. add at least one mirror in config tab.</div>
                {/if}
            {/if}
        </div>
    </div>
{/if}

<style>
    .mirror-warning {
        font-family: "Torus SemiBold";
        font-size: 0.8em;
        opacity: 0.8;
        margin-top: 8px;
    }
</style>
