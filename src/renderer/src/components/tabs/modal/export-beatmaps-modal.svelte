<script lang="ts">
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { show_notification } from "../../../lib/store/notifications";
    import { export_beatmaps } from "../../../lib/utils/collections";
    import { config } from "../../../lib/store/config";
    import Buttons from "../../utils/basic/buttons.svelte";

    let selected_collections: string[] = [];

    $: all_collections = collections.all_collections;

    const on_submit = async () => {
        if (selected_collections.length == 0) return;

        const result = await export_beatmaps(selected_collections);

        if (!result.success) {
            // FUCK SVELTE
            show_notification({ type: "error", text: (result as any).reason || "failed to export beatmaps" });
            return;
        }

        show_notification({ type: "success", text: `exported ${result.data ?? 0} beatmaps to ${config.get("export_path")}` });
        cleanup();
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
            <Buttons label="collections" options={$all_collections.map((c) => c.name)} bind:selected={selected_collections} />

            <div class="actions actions-separator">
                <button onclick={on_submit}>export</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}
