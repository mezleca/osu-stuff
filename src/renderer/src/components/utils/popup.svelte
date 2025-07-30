<script>
    import { onMount } from "svelte";
    import { get_popup_manager, hide_popup } from "../../lib/store/popup";

    // components
    import Dropdown from "./basic/dropdown.svelte";
    import Checkbox from "./basic/checkbox.svelte";

    // props
    export let key = "default";

    let popup_manager;
    let active_popup = null;
    let container = null;
    let element_values = {};

    $: active = active_popup != null;

    // sync store values
    $: if (active_popup?.popup) {
        active_popup.popup.elements.forEach((element) => {
            const store = active_popup.popup.element_stores.get(element.id);
            if (store) {
                store.subscribe((value) => {
                    element_values[element.id] = value;
                });
            }
        });
    }

    const update_store = (element_id, value) => {
        if (active_popup?.popup) {
            const store = active_popup.popup.element_stores.get(element_id);
            if (store) {
                store.set(value);
                active_popup.popup.reset_inactive_elements();
            }
        }
    };

    const toggle_button = (element_id, option_value, is_multiple = true) => {
        const current_values = element_values[element_id] || [];

        if (is_multiple) {
            const is_selected = current_values.includes(option_value);
            const new_values = is_selected ? current_values.filter((val) => val != option_value) : [...current_values, option_value];
            element_values[element_id] = new_values;
            update_store(element_id, new_values);
        } else {
            const new_value = current_values.includes(option_value) ? [] : [option_value];
            element_values[element_id] = new_value;
            update_store(element_id, new_value);
        }
    };

    const is_element_active = (element) => {
        if (!active_popup?.popup) {
            return false;
        }

        return active_popup.popup.is_element_active(element);
    };

    // @TODO: check if element is empty and has a required property
    const handle_submit = () => {
        if (active_popup?.popup) {
            const values = active_popup.popup.get_values();
            if (active_popup.popup.callback) {
                active_popup.popup.callback(values);
            }
            hide_popup(key);
        }
    };

    const handle_cancel = () => {
        hide_popup(key);
    };

    const remove_focus = (event) => {
        if (event.target != container) return;
        handle_cancel();
    };

    const get_children = (parent_id) => {
        if (!active_popup?.popup) return [];
        return active_popup.popup.elements.filter((el) => el.parent == parent_id);
    };

    const get_root_elements = () => {
        if (!active_popup?.popup) return [];
        return active_popup.popup.elements.filter((el) => !el.parent);
    };

    const get_addon_data = (element) => {
        return {
            element,
            children: get_children(element.id)
        };
    };

    onMount(() => {
        popup_manager = get_popup_manager(key);
        const unsubscribe = popup_manager.get_active_popup().subscribe((popup) => {
            active_popup = popup;
        });
        return unsubscribe;
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div bind:this={container} class="popup-container" onclick={remove_focus} class:show={active}>
    {#if active_popup}
        <div class="popup-content">
            {#each get_root_elements() as element}
                {@const element_data = get_addon_data(element)}
                {@const element_is_active = is_element_active(element, element_values)}
                {#if element_is_active}
                    {#if element.type == "text"}
                        <h1 class="text" style="font-size: {element.font_size || 14}px;">{element.text}</h1>
                    {/if}
                    {#if element.type == "checkbox"}
                        <div class="field-group">
                            <Checkbox
                                id={element.id}
                                bind:value={element_values[element.id]}
                                label={element.label || element.text}
                                onchange={update_store}
                            />
                        </div>
                    {:else if element.type == "input"}
                        <div class="field-group">
                            <label for={element.id} class="field-label">{element.label}</label>
                            <input
                                class="text-input"
                                type="text"
                                id={element.id}
                                placeholder={element.text}
                                bind:value={element_values[element.id]}
                                oninput={(e) => update_store(element.id, e.target.value)}
                                style={element.style}
                            />
                        </div>
                    {:else if element.type == "dropdown"}
                        <div class="field-group">
                            {#if element.label}
                                <!-- svelte-ignore a11y_label_has_associated_control -->
                                <label class="field-label">{element.label}</label>
                            {/if}
                            <Dropdown
                                options={element.data}
                                selected_value={element_values[element.id]}
                                placeholder={element.text}
                                on_update={(value) => update_store(element.id, value)}
                            />
                        </div>
                    {:else if element.type == "buttons"}
                        <div class="field-group">
                            {#if element.label}
                                <!-- svelte-ignore a11y_label_has_associated_control -->
                                <label class="field-label">{element.label}</label>
                            {/if}
                            <div class="buttons-container" style={element.style}>
                                {#each element.data as option}
                                    {@const is_selected = (element_values[element.id] || []).includes(option.value || option)}
                                    {@const label = option.label || option}
                                    {@const value = option.value || option}
                                    {@const is_multiple = element.multiple != false}
                                    <button
                                        class="select-button"
                                        class:selected={is_selected}
                                        onclick={() => toggle_button(element.id, value, is_multiple)}
                                    >
                                        {label}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {:else if element.type == "container"}
                        <div class="field-group">
                            <div class="container {element.class || ''}" id={element.id} style={element.style} class:inactive={!element_is_active}>
                                {#if element.text || element.label}
                                    <div class="container-title">
                                        {element.label || element.text}
                                        {#if element.active}
                                            <span class="status-indicator" class:active={element_is_active}>
                                                {element_is_active ? "●" : "○"}
                                            </span>
                                        {/if}
                                    </div>
                                {/if}
                                {#if element_is_active}
                                    {#each element_data.children as child}
                                        {@const child_is_active = is_element_active(child, element_values)}
                                        {#if child_is_active}
                                            {#if child.type == "text"}
                                                <h1 class="text" style="font-size: {child.font_size || 14}px;">{child.text}</h1>
                                            {/if}
                                            {#if child.type == "checkbox"}
                                                <div class="field-group">
                                                    <Checkbox
                                                        id={child.id}
                                                        bind:value={element_values[child.id]}
                                                        label={child.label || child.text}
                                                        onchange={update_store}
                                                    />
                                                </div>
                                            {:else if child.type == "input"}
                                                <div class="field-group">
                                                    <label for={child.id} class="field-label">{child.label}</label>
                                                    <input
                                                        class="text-input"
                                                        type="text"
                                                        id={child.id}
                                                        placeholder={child.text}
                                                        bind:value={element_values[child.id]}
                                                        oninput={(e) => update_store(child.id, e.target.value)}
                                                        style={child.style}
                                                    />
                                                </div>
                                            {:else if child.type == "dropdown"}
                                                <div class="field-group">
                                                    {#if child.label}
                                                        <!-- svelte-ignore a11y_label_has_associated_control -->
                                                        <label class="field-label">{child.label}</label>
                                                    {/if}
                                                    <Dropdown
                                                        options={child.data}
                                                        selected_value={element_values[child.id]}
                                                        placeholder={child.text}
                                                        on_update={(value) => update_store(child.id, value)}
                                                    />
                                                </div>
                                            {:else if child.type == "buttons"}
                                                <div class="field-group">
                                                    {#if child.label}
                                                        <!-- svelte-ignore a11y_label_has_associated_control -->
                                                        <label class="field-label">{child.label}</label>
                                                    {/if}
                                                    <div class="buttons-container" style={child.style}>
                                                        {#each child.data as option}
                                                            {@const is_selected = (element_values[child.id] || []).includes(option.value || option)}
                                                            {@const label = option.label || option}
                                                            {@const value = option.value || option}
                                                            {@const is_multiple = child.multiple != false}
                                                            <button
                                                                class="select-button"
                                                                class:selected={is_selected}
                                                                onclick={() => toggle_button(child.id, value, is_multiple)}
                                                            >
                                                                {label}
                                                            </button>
                                                        {/each}
                                                    </div>
                                                </div>
                                            {/if}
                                        {/if}
                                    {/each}
                                {:else}
                                    <div class="inactive-message">Container desativado</div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/if}
            {/each}

            <div class="popup-actions">
                <button class="popup-cancel" onclick={handle_cancel}>cancel</button>
                <button class="popup-submit" onclick={handle_submit}>submit</button>
            </div>
        </div>
    {/if}
</div>

<style>
    .popup-container {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        background-color: #20202067;
        animation: smooth-appear 0.15s ease forwards;
    }

    .popup-container.show {
        display: flex;
    }

    :global(.popup-content) {
        padding: 20px;
        border-radius: 6px;
        background-color: var(--bg-tertiary);
        border: 1px solid rgb(90, 90, 90, 0.5);
        min-width: 500px;
        max-height: 85%;
        overflow: hidden;
        overflow-y: scroll;
        margin-top: 50px; /* header height idk */
    }

    .text {
        font-size: 15px;
        color: var(--text-color);
        margin-bottom: 15px;
    }

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
        color: var(--text-primary);
        font-size: 14px;
    }

    .text-input:focus {
        outline: none;
        border-color: var(--accent-color);
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
        font-weight: 500;
        margin-bottom: 10px;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .status-indicator {
        font-size: 12px;
        color: #666;
        transition: color 0.2s ease;
    }

    .status-indicator.active {
        color: var(--accent-color);
    }

    .inactive-message {
        color: #666;
        font-style: italic;
        text-align: center;
        padding: 20px;
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

    .popup-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #333;
    }

    .popup-cancel,
    .popup-submit {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.15s ease;
    }

    .popup-cancel {
        background: #333;
        color: var(--text-secondary);
    }

    .popup-submit {
        background: var(--accent-color);
        color: white;
    }

    .popup-cancel:hover {
        background: #404040;
    }

    .popup-submit:hover {
        background: var(--accent-color2);
    }
</style>
