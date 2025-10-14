<script>
    // props
    export let element;
    export let value;
    export let on_update;
    export let on_toggle;

    // components
    import Dropdown from "../basic/dropdown.svelte";
    import Checkbox from "../basic/checkbox.svelte";
    import InputDialog from "../input-dialog.svelte";
    import RangeSlider from "../basic/range-slider.svelte";

    $: range = element?.value ?? { min: element?.min ?? 0, max: element?.max ?? 10 };
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
            oninput={(e) => on_update(element.id, e.target.value)}
        />
    {:else if element.type == "checkbox"}
        <Checkbox id={element.id} bind:value label={element.label || element.text} onchange={(id, val) => on_update(id, val)} />
    {:else if element.type == "dropdown"}
        {@const data = typeof element.data == "function" ? element.data() : element.data}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}
        <Dropdown is_static={true} options={data} selected_value={value} placeholder={element.text} on_update={(val) => on_update(element.id, val)} />
    {:else if element.type == "file-dialog"}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}
        <InputDialog type={element.dialog_type || "file"} location={value} callback={(val) => on_update(element.id, val)} />
        <!-- @TODO: button is only supported on ConfirmAddon -->
    {:else if element.type == "button"}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}

        <div class="button-container">
            <!-- @NOTE: on_update will call submit on ConfirmAddon -->
            <button class="select-button {element.class || ''}" onclick={() => on_update(element.text)}>{element.text}</button>
        </div>
    {:else if element.type == "buttons"}
        {@const data = typeof element.data == "function" ? element.data() : element.data}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label {element.class || ''}">{element.label}</label>
        {/if}
        <div class="buttons-container {element.class || ''}" style={element.style}>
            {#each data as option}
                {@const option_value = option.value || option}
                {@const option_label = option.label || option}
                {@const is_selected = (value || []).includes(option_value)}

                <button class="select-button" class:selected={is_selected} onclick={() => on_toggle(element.id, option_value, element.multiple)}>
                    {option_label}
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
            min={+range.min}
            max={+range.max}
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
