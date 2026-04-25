<script lang="ts">
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { convert_special_key } from "../../../lib/store/other";

    // props
    export let options: { label: string | number; value: string | number }[] = [];
    export let label: string = "";
    export let inline = false;
    export let selected_value: string | number;
    export let is_static = false;
    export let on_update: (value: string | number) => {} = null;
    export let placeholder = "select an option";

    let is_open = false;
    let dropdown: HTMLDivElement;
    let trigger: HTMLButtonElement;

    const toggle_dropdown = () => (is_open = !is_open);

    const select_option = (option: { label: string | number; value: string | number }) => {
        const result = option.value;
        if (result != selected_value) {
            selected_value = result;
            if (on_update) on_update(selected_value);
        }
        is_open = false;
    };

    const handle_click_outside = (event: any) => {
        if (is_open && dropdown && !dropdown.contains(event.target)) {
            is_open = false;
        }
    };

    const handle_keydown = (event: any) => {
        if (event.key == "Escape") {
            is_open = false;
        }
    };

    onMount(() => {
        window.addEventListener("click", handle_click_outside, true);
        window.addEventListener("keydown", handle_keydown);

        return () => {
            window.removeEventListener("click", handle_click_outside, true);
            window.removeEventListener("keydown", handle_keydown);
        };
    });
</script>

<div class="field-group" style="display: flex; flex-direction: {inline ? 'row' : 'column'}; max-width: 100%; ">
    {#if label != ""}
        <div
            class="field-label clickable-label"
            style="margin-right: {inline ? '10px' : '0'}; align-self: {inline ? 'center' : 'auto'}; color: var(--text-secondary);"
            role="button"
            tabindex="0"
            onclick={toggle_dropdown}
            onkeydown={(event) => {
                if (event.key == "Enter" || event.key == " ") {
                    event.preventDefault();
                    toggle_dropdown();
                }
            }}
        >
            {convert_special_key(label)}
        </div>
    {/if}

    <div class="dropdown_container" bind:this={dropdown}>
        <button class="dropdown_trigger" class:active={is_open} onclick={toggle_dropdown} type="button" bind:this={trigger}>
            <span class="dropdown_text">{convert_special_key(String(selected_value)) || placeholder}</span>
            <div class="dropdown_arrow" class:active={is_open}></div>
        </button>

        {#if is_open}
            <div
                class="dropdown_menu"
                class:static={is_static}
                transition:slide={{ duration: 100 }}
                style={!is_static && trigger ? `min-width: ${trigger.offsetWidth}px;` : ""}
            >
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
    .field-group {
        gap: 6px;
    }

    .field-label {
        margin-bottom: 0;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-muted);
    }

    .clickable-label {
        cursor: pointer;
    }

    .dropdown_container {
        display: flex;
        flex-direction: column;
        position: relative;
        flex: 1 1 auto;
        min-width: 120px;
        z-index: 5;
    }

    .dropdown_trigger {
        background: #181818;
        padding: 6px 10px;
        padding-right: 28px;
        width: 100%;
        min-width: 0;
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 13px;
        color: var(--text-secondary);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        position: relative;
    }

    .dropdown_trigger:hover {
        background: #222222;
        border-color: rgba(255, 255, 255, 0.1);
    }

    .dropdown_trigger.active {
        border-color: rgba(255, 255, 255, 0.14);
        background: #222222;
    }

    .dropdown_text {
        font-family: "Torus SemiBold";
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dropdown_arrow {
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid #888;
        transition: transform 0.2s ease;
        position: absolute;
        right: 12px;
        flex-shrink: 0;
    }

    .dropdown_arrow.active {
        transform: rotate(180deg);
    }

    .dropdown_menu {
        background: #181818;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        overflow-y: auto;
        max-height: 300px;
    }

    .dropdown_menu:not(.static) {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 9999;
    }

    .dropdown_menu.static {
        width: 100%;
    }

    .dropdown_item {
        padding: 8px 10px;
        cursor: pointer;
        transition: background 0.1s ease;
        font-size: 13px;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        width: 100%;
        text-align: left;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: "Torus SemiBold";
        display: block;
    }

    .dropdown_item:last-child {
        border-bottom: none;
    }

    .dropdown_item:hover {
        background: rgba(255, 255, 255, 0.05);
    }

    .dropdown_item:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.05);
    }
</style>
