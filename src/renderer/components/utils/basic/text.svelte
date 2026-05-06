<script lang="ts">
    import { tick } from "svelte";
    import { block_global_shortcuts } from "../../../lib/actions/input";

    // props
    export let value = "";
    export let update_callback: (a: string, b: string) => void = null;
    export let edit = false;

    let id = crypto.randomUUID();
    let edit_value = "";
    let element: HTMLTextAreaElement = null;
    let was_editing = false;

    const finish_edit = (next_value: string) => {
        if (!update_callback) {
            return;
        }

        update_callback(value, next_value);
    };

    const update_text_area_height = (event) => {
        const target = event.target;
        target.style.height = "auto";
        target.style.height = target.scrollHeight + "px";
    };

    const handle_keydown = (event: KeyboardEvent) => {
        if (!edit) {
            return;
        }

        const next_value = event.key == "Escape" ? value : edit_value;

        if (event.key != "Escape" && event.key != "Enter") {
            return;
        }

        edit_value = next_value;
        finish_edit(next_value);

        event.preventDefault();
        event.stopPropagation();
    };

    $: if (edit && !was_editing) {
        was_editing = true;
        edit_value = value;

        tick().then(() => {
            element?.focus();
        });
    }

    $: if (!edit && was_editing) {
        was_editing = false;
    }
</script>

{#if edit}
    <textarea
        bind:this={element}
        {id}
        class="text-edit"
        bind:value={edit_value}
        use:block_global_shortcuts
        onkeydown={handle_keydown}
        oninput={update_text_area_height}
        rows={1}
    ></textarea>
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
