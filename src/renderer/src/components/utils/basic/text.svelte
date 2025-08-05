<script>
    import { onMount, onDestroy } from "svelte";

    // @TODO: use InputManager instead of creating a new listener for each component

    // props
    export let value = "";
    export let update_callback = null;
    export let edit = false;

    let id = crypto.randomUUID();
    let added_listeners = false;

    $: value = value;
    $: edit_value = "";
    $: element = null;

    // update via callback
    const update_value = () => {
        if (update_callback) update_callback(value, edit_value);
    };

    // only add listeners when edit is true
    $: if (edit && !added_listeners) {
        window.addEventListener("mouseup", on_mouse_up);
        window.addEventListener("keypress", on_keypress);
        added_listeners = false;
    }

    // automatically focus on edit
    $: if (element && edit) {
        console.log("focusing");
        element.focus();
    }

    const update_text_area_height = (event) => {
        const target = event.target;
        target.style.height = "auto";
        target.style.height = target.scrollHeight + "px";
    };

    const on_keypress = (event) => {
        if (!edit) return;
        if (event.key == "Enter") update_value();
    };

    // @TODO (MAYBE): a way to check if we clicked on an parent or something
    const on_mouse_up = () => {
        if (!edit) return;
        update_value();
    };

    onMount(() => {
        edit_value = value;
    });

    onDestroy(() => {
        window.removeEventListener("mouseup", on_mouse_up);
        window.removeEventListener("keypress", on_keypress);
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
