<script lang="ts">
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { show_notification } from "../../../lib/store/notifications";
    import Input from "../../utils/basic/input.svelte";
    import Buttons from "../../utils/basic/buttons.svelte";

    let name = "";
    let selected_collections: string[] = [];

    $: all_collections = collections.all_collections;

    const on_submit = async () => {
        if (selected_collections.length < 2) {
            show_notification({ type: "error", text: "you need at least 2 or more collections my guy" });
            return;
        }

        if (name == "") {
            show_notification({ type: "error", text: "wheres the name bro" });
            return;
        }

        if (collections.get(name)) {
            show_notification({ type: "error", text: "this collection already exists!" });
            return;
        }

        const beatmaps: Set<string> = new Set();

        for (const col_name of selected_collections) {
            const collection = collections.get(col_name);
            if (collection) {
                collection.beatmaps.map((h) => beatmaps.add(h));
            }
        }

        const create_result = await collections.create_collection(name);

        if (!create_result) {
            return;
        }

        show_notification({ type: "success", text: `created ${name}` });
        collections.add_beatmaps(name, Array.from(beatmaps.values()));
        cleanup();
    };

    const cleanup = () => {
        name = "";
        selected_collections = [];
        show_modal(ModalType.none);
    };
</script>

{#if $current_modal == ModalType.merge_collection}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <Input label="name" bind:value={name} />

            <Buttons label="collections to merge" options={$all_collections.map((c) => c.name)} bind:selected={selected_collections} />

            <div class="actions actions-separator">
                <button onclick={on_submit}>merge</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}
