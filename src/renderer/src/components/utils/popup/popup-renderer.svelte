<script>
    import Dropdown from "../basic/dropdown.svelte";
    import Checkbox from "../basic/checkbox.svelte";

    export let element;
    export let value;
    export let on_update;
    export let on_toggle;
</script>

<div class="field-group">
    {#if element.type == "text"}
        <h1 class="text-element" style="font-size: {element.font_size}px;">
            {element.text}
        </h1>
        
    {:else if element.type == "input"}
        <label for={element.id} class="field-label">{element.label}</label>
        <input
            id={element.id}
            class="text-input"
            type="text"
            placeholder={element.text}
            value={value || ""}
            style={element.style}
            on:input={(e) => on_update(element.id, e.target.value)}
        />
        
    {:else if element.type == "checkbox"}
        <Checkbox
            id={element.id}
            bind:value
            label={element.label || element.text}
            onchange={(id, val) => on_update(id, val)}
        />
        
    {:else if element.type == "dropdown"}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label">{element.label}</label>
        {/if}
        <Dropdown
            options={element.data}
            selected_value={value}
            placeholder={element.text}
            on_update={(val) => on_update(element.id, val)}
        />
        
    {:else if element.type == "buttons"}
        {#if element.label}
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label">{element.label}</label>
        {/if}
        <div class="buttons-container" style={element.style}>
            {#each element.data as option}
                {@const option_value = option.value || option}
                {@const option_label = option.label || option}
                {@const is_selected = (value || []).includes(option_value)}
                
                <button
                    class="select-button"
                    class:selected={is_selected}
                    on:click={() => on_toggle(element.id, option_value, element.multiple != false)}
                >
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
            
            <!-- Slot for container children -->
            <div class="container-content">
                <slot></slot>
            </div>
        </div>
    {/if}
</div>

<style>
    .field-group {
        margin-bottom: 15px;
    }

    .field-label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
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
        margin-bottom: 15px;
    }

    .container.inactive {
        opacity: 0.5;
        background: #111;
        border-color: #222;
    }

    .container-title {
        font-weight: 500;
        margin-bottom: 15px;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
    }

    .container-content {
        /* Children of container will be rendered here */
    }

    .buttons-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
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