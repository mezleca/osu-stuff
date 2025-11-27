<script lang="ts">
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import Input from "../../utils/basic/input.svelte";

    let name = "";

    const on_submit = async () => {
        const result = collections.create_collection(name);

        if (!result) {
            return;
        }

        cleanup();
    };

    const cleanup = () => {
        name = "";
        show_modal(ModalType.none);
    };
</script>

{#if $current_modal == ModalType.empty_collection}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <Input label="name" bind:value={name} />

            <div class="actions actions-separator">
                <button onclick={on_submit}>create</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}
