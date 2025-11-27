<script lang="ts">
    import { slide } from "svelte/transition";
    import { convert_special_key } from "../../../lib/store/other";
    import { onMount, tick } from "svelte";

    // props
    export let options: { label: string | number; value: string | number }[] = [];
    export let label: string = "";
    export let selected_value: string | number;
    export let is_static = false;
    export let on_update: (value: string | number) => {} = null;
    export let placeholder = "select an option";

    let is_open = false;
    let dropdown: HTMLDivElement;
    let container_width = "auto";

    const toggle_dropdown = () => (is_open = !is_open);

    const select_option = (option) => {
        const result = option.value || option;
        if (result != selected_value) {
            selected_value = result;
            if (on_update) on_update(selected_value);
        }
        is_open = false;
    };

    const handle_click_outside = (event) => {
        if (dropdown && !dropdown.contains(event.target)) {
            is_open = false;
        }
    };

    const handle_keydown = (event) => {
        if (event.key == "Escape") {
            is_open = false;
        }
    };

    const calculate_width = async () => {
        await tick();

        const temp_span = document.createElement("span");
        temp_span.style.visibility = "hidden";
        temp_span.style.position = "absolute";
        temp_span.style.fontSize = "14px";
        temp_span.style.whiteSpace = "nowrap";
        document.body.appendChild(temp_span);

        let max_width = 0;

        // check placeholder
        temp_span.innerText = placeholder;
        max_width = Math.max(max_width, temp_span.getBoundingClientRect().width);

        // check options
        for (const option of options) {
            temp_span.innerText = convert_special_key(String(option.label));
            max_width = Math.max(max_width, temp_span.getBoundingClientRect().width);
        }

        document.body.removeChild(temp_span);

        // padding (12px * 2) + arrow (8px) + arrow margin (8px) + extra buffer (4px)
        const total_padding = 24 + 8 + 8 + 4;
        container_width = `${max_width + total_padding}px`;
    };

    $: (options, calculate_width());

    onMount(() => {
        calculate_width();
    });
</script>

<svelte:window onclick={handle_click_outside} on:keydown={handle_keydown} />

<div class="field-group">
    {#if label != ""}
        <div class="field-label">{label}</div>
    {/if}
    <div class="dropdown_container" bind:this={dropdown} style="width: {container_width}">
        <button class="dropdown_trigger" class:active={is_open} onclick={toggle_dropdown} type="button">
            <span class="dropdown_text">{convert_special_key(String(selected_value)) || placeholder}</span>
            <div class="dropdown_arrow" class:active={is_open}></div>
        </button>
        {#if is_open}
            <div class="dropdown_menu" class:static={is_static} transition:slide={{ duration: 100 }}>
                {#each options as option}
                    <button class="dropdown_item" onclick={() => select_option(option)} type="button">
                        {convert_special_key(String(option.label))}
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .dropdown_container {
        position: relative;
        display: inline-block;
        flex: 1;
        min-width: 64px;
    }

    .dropdown_trigger {
        background: #1a1a1a;
        padding: 8px 12px;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 14px;
        color: var(--text-secondary);
        white-space: nowrap;
    }

    .dropdown_trigger:hover {
        background: #252525;
        border-color: #444;
    }

    .dropdown_trigger.active {
        border-color: #555;
        background: #252525;
    }

    .dropdown_text {
        text-align: left;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .dropdown_arrow {
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid #888;
        transition: transform 0.2s ease;
        margin-left: 8px;
        flex-shrink: 0;
    }

    .dropdown_arrow.active {
        transform: rotate(180deg);
    }

    .dropdown_menu {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        width: 100%;
    }

    .dropdown_menu:not(.static) {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 1000;
    }

    .dropdown_item {
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.1s ease;
        font-size: 14px;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        width: 100%;
        text-align: left;
        border-bottom: 1px solid #2a2a2a;
        white-space: nowrap;
    }

    .dropdown_item:last-child {
        border-bottom: none;
    }

    .dropdown_item:hover {
        background: #252525;
    }

    .dropdown_item:focus {
        outline: none;
        background: #252525;
    }
</style>
