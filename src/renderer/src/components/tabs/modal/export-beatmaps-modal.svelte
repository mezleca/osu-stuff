<script lang="ts">
    import { current_modal, ModalType, quick_confirm, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { show_notification } from "../../../lib/store/notifications";
    import { export_beatmaps } from "../../../lib/utils/collections";
    import { config } from "../../../lib/store/config";

    // components
    import Spinner from "../../icon/spinner.svelte";
    import CollectionCard from "../../cards/collection-card.svelte";

    let { is_exporting } = config;
    let selected_collections: string[] = [];

    $: all_collections = collections.all_collections;

    const on_submit = async () => {
        if (selected_collections.length == 0) {
            console.warn("export_beatmaps_modal: nothing selected");
            return;
        }

        try {
            $is_exporting = true;
            const result = await export_beatmaps(selected_collections);

            if (!result.success) {
                show_notification({ type: "error", text: (result as any).reason || "failed to export beatmaps" });
            } else {
                show_notification({ type: "success", text: `exported ${result.data ?? 0} beatmaps to ${config.get("export_path")}` });
            }
        } catch(err) {
            console.error(err);
        } finally {
            $is_exporting = false;
            cleanup();
        }
    };

    const toggle_selection = (name: string) => {
        if (selected_collections.includes(name)) {
            selected_collections = selected_collections.filter((c) => c != name);
        } else {
            selected_collections = [...selected_collections, name];
        }
    };

    const cleanup = async () => {
        if ($is_exporting) {
            // TODO: since the modal state is shared, this will replace this one
            const request = await quick_confirm("do you want to cancel the current export?", { submit: "yeah", cancel: "nah" });

            if (!request) {
                return;
            }

            $is_exporting = false;

            // NOTE: even tough this modal is not visible, clean to prevent future issues
            cleanup();
        } else {
            selected_collections = [];
            show_modal(ModalType.none);
        }
    };
</script>

{#if $current_modal == ModalType.export_beatmaps}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            {#if $is_exporting}
                <div class="modal-spinner" onclick={(e) => e.stopPropagation()}>
                    <Spinner />
                </div>
            {/if}
            <h1 class="field-label">export from:</h1>
            {#each $all_collections as collection}
                <CollectionCard
                    name={collection.name}
                    count={collection.beatmaps.length}
                    selected={selected_collections.includes(collection.name)}
                    on_select={() => toggle_selection(collection.name)}
                />
            {/each}
            <div class="actions actions-separator">
                <button onclick={on_submit}>export</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}
