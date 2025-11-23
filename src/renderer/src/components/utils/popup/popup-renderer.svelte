<script lang="ts">
    import type { PopupElement, DropdownElement, FileDialogElement, ButtonsElement } from "../../../lib/store/popup/types";

    // props
    export let element: PopupElement;
    export let value: any;
    export let on_update: (id: string, value: any) => any;
    export let on_toggle: (id: string, value: any, multiple?: boolean) => void;
    export let on_submit: (value: any) => void = null;

    // components
    import Dropdown from "../basic/dropdown.svelte";
    import Checkbox from "../basic/checkbox.svelte";
    import InputDialog from "../input-dialog.svelte";
    import RangeSlider from "../basic/range-slider.svelte";

    $: range = element.type == "range" ? (value ?? [element.min, element.max]) : [0, 10];
</script>

<div class="field-group">
    {#if element.type == "text"}
        <h1 class="text-element {element.class || ''}" style="font-size: {element.font_size}px;">
            {element.text}
        </h1>
    {:else if element.type == "input"}
        <label for={element.id} class="field-label {element.class || ''}">{element.label}</label>
        <input
            id={element.id}
            class="text-input {element.class || ''}"
            type="text"
            placeholder={element.text}
            value={value || ""}
            oninput={(e) => on_update(element.id, e.currentTarget.value)}
        />
    {:else if element.type == "checkbox"}
        <Checkbox id={element.id} bind:value label={element.label || element.text} onchange={(id, val) => on_update(id, val)} />
    {:else if element.type == "dropdown"}
        {@const dropdown_element = element as DropdownElement}
        {@const data = typeof dropdown_element.data == "function" ? dropdown_element.data() : dropdown_element.data}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}
        <Dropdown is_static={true} options={data} selected_value={value} placeholder={element.text} on_update={(val) => on_update(element.id, val)} />
    {:else if element.type == "file-dialog"}
        {@const dialog_element = element as FileDialogElement}
        {@const dialog_type = dialog_element.dialog_type == "folder" ? "openDirectory" : "openFile"}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}
        <InputDialog type={dialog_type} location={value} callback={(val) => on_update(element.id, val)} />
    {:else if element.type == "button"}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}

        <div class="button-container">
            <button
                class="select-button {element.class || ''}"
                onclick={() => (on_submit ? on_submit(element.id) : on_update(element.id, element.id))}>{element.text}</button
            >
        </div>
    {:else if element.type == "buttons"}
        {@const buttons_element = element as ButtonsElement}
        {@const data = typeof buttons_element.data == "function" ? buttons_element.data() : buttons_element.data}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}
        <div class="buttons-container {element.class || ''}" style={element.style}>
            {#each data as option}
                {@const is_selected = (value || []).includes(option.value)}

                <button class="select-button" class:selected={is_selected} onclick={() => on_toggle(element.id, option.value, element.multiple)}>
                    {option.label}
                </button>
            {/each}
        </div>
    {:else if element.type == "container"}
        <div class="container {element.class || ''}" style={element.style}>
            {#if element.text || element.label}
                <div class="container-title">
                    {element.label || element.text}
                </div>
            {/if}

            <!-- slot for children -->
            <div class="container-content">
                <slot></slot>
            </div>
        </div>
    {:else if element.type == "range"}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}
        <RangeSlider
            min={range[0]}
            max={range[1]}
            min_bound={element.min ?? 0}
            max_bound={element.max ?? 10}
            on_update={(data) => on_update(element.id, data)}
        />
    {/if}
</div>

<style>
    .field-group {
        margin-bottom: 15px;
    }

    .field-label {
        display: block;
        margin-bottom: 5px;
        color: var(--text-primary);
    }

    .text-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #444;
        border-radius: 4px;
        background: #2a2a2a;
        color: var(--text-secondary);
        font-size: 14px;
    }

    .text-input:focus {
        outline: none;
        border-color: var(--accent-color);
    }

    .text-element {
        color: var(--text-primary);
        margin: 0 0 10px 0;
    }

    .container {
        border: 1px solid #333;
        padding: 15px;
        border-radius: 4px;
        background: #1a1a1a;
        transition: all 0.2s ease;
    }

    .container.inactive {
        opacity: 0.5;
        background: #111;
        border-color: #222;
    }

    .container-title {
        margin-bottom: 15px;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
    }

    .button-container,
    .buttons-container {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
    }

    .buttons-container {
        margin-top: 8px;
        gap: 8px;
    }

    .select-button {
        padding: 10px 15px;
        border: 1px solid #444;
        border-radius: 4px;
        background: #2a2a2a;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 14px;
        transition: all 0.15s ease;
        text-align: left;
    }

    .select-button:hover {
        background: #333;
        border-color: #555;
    }

    .select-button.selected {
        background: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
    }

    .select-button.selected:hover {
        background: var(--accent-color2);
        border-color: var(--accent-color2);
    }
</style>
