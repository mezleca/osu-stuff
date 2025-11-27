<script lang="ts">
    import { current_modal, ModalType, quick_confirm_options } from "../../../lib/utils/modal";

    const on_confirm = () => {
        if ($quick_confirm_options?.on_confirm) {
            $quick_confirm_options.on_confirm();
        }
    };

    const on_cancel = () => {
        if ($quick_confirm_options?.on_cancel) {
            $quick_confirm_options.on_cancel();
        }
    };
</script>

{#if $current_modal == ModalType.quick_confirm && $quick_confirm_options}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={on_cancel}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <div class="title" style="margin-bottom: 12px; text-align: center;">{$quick_confirm_options.text}</div>
            <div class="actions">
                <button class="confirm" onclick={on_confirm}>{$quick_confirm_options.confirm_text}</button>
                <button class="cancel" onclick={on_cancel}>{$quick_confirm_options.cancel_text}</button>
            </div>
        </div>
    </div>
{/if}
