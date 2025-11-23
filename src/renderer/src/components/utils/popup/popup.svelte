<script lang="ts">
    import { get_popup_manager, hide_popup } from "../../../lib/store/popup/store";
    import type { PopupElement } from "../../../lib/store/popup/types";

    // props
    export let key = "default";

    // components
    import PopupRenderer from "./popup-renderer.svelte";

    let manager = get_popup_manager(key);
    let active_popup = manager.active;
    let container = null;

    $: active_elements = get_visible_elements($active_popup);
    $: is_active = $active_popup != null;
    $: hide_actions = $active_popup?.popup?.hide_actions ?? false;

    const handle_submit = (value?: any) => {
        // if value is provided (from custom button), use it directly
        // otherwise get all values from visible elements
        const values = value !== undefined ? value : manager.get_values($active_popup.popup);
        const callback = $active_popup.popup.callback;

        // close popup first
        hide_popup(key);

        // and then use the stored callback if available
        if (callback) callback(values);
    };

    const handle_cancel = (value?: any) => {
        // if we have and value, submit it
        if (value) {
            handle_submit(value);
            return;
        }

        // otherwise just hide and call the cancel callback
        const callback = $active_popup.popup.cancel_callback;

        hide_popup(key);
        if (callback) callback();
    };

    const close_on_backdrop = (event) => {
        if (event.target == container) {
            handle_cancel();
        }
    };

    const update_element = (element_id, value) => {
        manager.update_element($active_popup.popup, element_id, value);
    };

    const toggle_button = (id, value, is_multiple) => {
        const element = $active_popup.popup.elements.get(id);

        if (!element) {
            console.log("toggle_button(): failed to get", id);
            return;
        }

        // @ts-ignore
        const current_value = element.value || [];
        let new_value;
        const is_selected = current_value.includes(value);

        if (is_multiple) {
            new_value = is_selected ? current_value.filter((v) => v != value) : [...current_value, value];
        } else {
            new_value = is_selected ? [] : [value];
        }

        update_element(id, new_value);
    };

    const get_visible_elements = (active): PopupElement[] => {
        if (!active?.popup) {
            return [];
        }

        const elements = Array.from(active.popup.elements.values()) as PopupElement[];
        const visible = elements.filter((el) => manager.should_show_element(el, active.popup.elements));

        // return only root elements
        return visible.filter((el) => !el.parent);
    };

    const get_children = (parent_id): PopupElement[] => {
        if (!$active_popup?.popup) return [];

        const elements = Array.from($active_popup.popup.elements.values()) as PopupElement[];
        const visible = elements.filter((el) => manager.should_show_element(el, $active_popup.popup.elements));

        return visible.filter((el) => el.parent == parent_id);
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={container} class="popup-container" class:show={is_active} onclick={close_on_backdrop}>
    {#if $active_popup}
        <div class="popup">
            <div class="content">
                {#each active_elements as element}
                    {#if element.type == "container"}
                        <PopupRenderer {element} value={element.value} on_update={update_element} on_toggle={toggle_button} on_submit={handle_submit}>
                            {#each get_children(element.id) as child}
                                <PopupRenderer
                                    element={child}
                                    value={child.value}
                                    on_update={update_element}
                                    on_toggle={toggle_button}
                                    on_submit={handle_submit}
                                />
                            {/each}
                        </PopupRenderer>
                    {:else}
                        <PopupRenderer
                            {element}
                            value={element.value}
                            on_update={update_element}
                            on_toggle={toggle_button}
                            on_submit={handle_submit}
                        />
                    {/if}
                {/each}
            </div>
            {#if !hide_actions}
                <div class="actions actions-separator">
                    <button class="submit-btn" onclick={() => handle_submit()}>
                        {$active_popup.popup.custom_action ? $active_popup.popup.custom_submit : "submit"}
                    </button>
                    <button class="cancel-btn" onclick={() => handle_cancel()}>
                        {$active_popup.popup.custom_action ? $active_popup.popup.custom_cancel : "cancel"}
                    </button>
                </div>
            {/if}
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
        z-index: 1000;
        background-color: #20202067;
        animation: smooth-appear 0.15s ease forwards;
    }

    .popup-container.show {
        display: block;
    }

    .popup {
        position: absolute;
        display: grid;
        grid-template-rows: 1fr auto;
        padding: 20px;
        border-radius: 6px;
        background-color: var(--bg-tertiary);
        border: 1px solid rgb(90, 90, 90, 0.5);
        overflow: hidden;
        width: 40%;
        max-width: 70%;
        max-height: 85%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    .content::-webkit-scrollbar {
        display: none;
    }

    .content {
        overflow: hidden;
        overflow-y: visible;
        flex-direction: column;
        background: var(--bg-tertiary);
    }

    .actions {
        display: flex;
        gap: 10px;
        justify-content: center;
    }

    .actions-separator {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #333;
    }
</style>
