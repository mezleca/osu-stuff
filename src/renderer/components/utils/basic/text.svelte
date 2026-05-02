<script lang="ts">
    import { onMount } from "svelte";
    import { input } from "../../../lib/store/input";

    // props
    export let value = "";
    export let update_callback: (a: string, b: string) => void = null;
    export let edit = false;

    let id = crypto.randomUUID();

    $: edit_value = "";
    $: element = null;

    // update via callback
    const update_value = () => {
        if (update_callback) update_callback(value, edit_value);
    };

    // automatically focus on edit
    $: if (element && edit) {
        element.focus();
    }

    const update_text_area_height = (event) => {
        const target = event.target;
        target.style.height = "auto";
        target.style.height = target.scrollHeight + "px";
    };

    const release = () => {
        if (!edit) return;
        update_value();
    };

    onMount(() => {
        edit_value = value;

        const handle_escape_id = input.on("escape", () => release());
        const handle_enter_id = input.on("enter", () => release());

        return () => {
            input.unregister(handle_enter_id);
            input.unregister(handle_escape_id);
        };
    });
</script>

{#if edit}
    <textarea bind:this={element} {id} class="text-edit" bind:value={edit_value} oninput={update_text_area_height} rows={1}></textarea>
{:else}
    <span>{value}</span>
{/if}

<style>
    span {
        font-size: 15px;
        color: var(--text-secondary);
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }

    .text-edit {
        outline: none;
        border: none;
        resize: none;
        background: transparent;
        margin: 0;
        padding: 0;
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 15px;
        overflow: hidden;
        box-sizing: border-box;
    }

    .text-edit:focus {
        outline: none;
    }
</style>
