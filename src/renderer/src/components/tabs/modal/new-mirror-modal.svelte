<script lang="ts">
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { config } from "../../../lib/store/config";
    import { show_notification } from "../../../lib/store/notifications";
    import Input from "../../utils/basic/input.svelte";

    let name = "";
    let url = "";

    const { mirrors } = config;

    const on_submit = async () => {
        if (name == "" || url == "") {
            show_notification({ text: "missing name/url dumbass", type: "error" });
            return;
        }

        // check for duplicates
        const existing_mirror = $mirrors.find((m) => m.name == name);
        if (existing_mirror) {
            show_notification({ text: "mirror with this name already exists", type: "error" });
            return;
        }

        // add new mirror to database
        await window.api.invoke("mirrors:save", { name, url });

        // force update
        await config.load();
        cleanup();
    };

    const cleanup = () => {
        name = "";
        url = "";
        show_modal(ModalType.none);
    };
</script>

{#if $current_modal == ModalType.new_mirror}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <Input label="name" bind:value={name} placeholder="ex: beatconnect" />
            <Input label="url" bind:value={url} placeholder="ex: https://beatconnect.io/d/" />

            <div class="actions actions-separator">
                <button onclick={on_submit}>add</button>
                <button onclick={cleanup}>cancel</button>
            </div>
        </div>
    </div>
{/if}
