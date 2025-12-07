<script lang="ts">
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { show_notification } from "../../../lib/store/notifications";
    import { export_collections } from "../../../lib/utils/collections";
    import { config } from "../../../lib/store/config";
    import type { ICollectionResult } from "@shared/types";
    import Buttons from "../../utils/basic/buttons.svelte";
    import Dropdown from "../../utils/basic/dropdown.svelte";

    let selected_collections: string[] = [];
    let type = "db";

    $: all_collections = collections.all_collections;

    const on_submit = async () => {
        const to_export: ICollectionResult[] = [];

        for (const name of selected_collections) {
            const target = collections.get(name);

            if (target) {
                to_export.push(target);
            }
        }

        if (to_export.length == 0) {
            show_notification({ type: "error", text: "select at least one collection" });
            return;
        }

        // TODO: generic result
        const result = await export_collections(to_export, type);

        if (!result) {
            show_notification({ type: "error", text: "failed to export" });
            return;
        }

        show_notification({ type: "success", text: `exported to ${config.get("export_path")}` });
        cleanup();
    };

    const cleanup = () => {
        selected_collections = [];
        show_modal(ModalType.none);
    };
</script>

{#if $current_modal == ModalType.export_collection}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <Buttons label="collections" options={$all_collections.map((c) => c.name)} bind:selected={selected_collections} />

            <Dropdown
                label="type"
                placeholder="..."
                bind:selected_value={type}
                options={[
                    { label: "db", value: "db" },
                    { label: "osdb", value: "osdb" }
                ]}
            />

            <div class="actions actions-separator">
                <button onclick={on_submit}>export</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}
