<script lang="ts">
    import { slide } from "svelte/transition";
    import { convert_special_key } from "../../../lib/store/other";

    // props
    export let options: { label: string | number; value: string | number }[] = [];
    export let selected_value: string | number;
    export let is_static = false;
    export let on_update: (value: string | number) => {} = null;
    export let placeholder = "select an option";

    let is_open = false;
    let dropdown: HTMLDivElement;

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
</script>

<svelte:window onclick={handle_click_outside} on:keydown={handle_keydown} />

<div class="dropdown_container" bind:this={dropdown}>
    <button class="dropdown_trigger" class:active={is_open} onclick={toggle_dropdown} type="button">
        <span class="dropdown_text">{convert_special_key(String(selected_value))}</span>
        <div class="dropdown_arrow" class:active={is_open}></div>
    </button>
    {#if is_open}
        <div class="dropdown_menu" class:static={is_static} transition:slide={{ duration: 100 }}>
            {#each options as option}
                <button class="dropdown_item" onclick={() => select_option(option)} type="button">
                    {option.label}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .dropdown_container {
        position: relative;
        display: inline-block;
        width: fit-content;
        flex: 1;
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
    }

    .dropdown_arrow {
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid #888;
        transition: transform 0.2s ease;
        margin-left: 8px;
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
    }

    .dropdown_menu:not(.static) {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
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
