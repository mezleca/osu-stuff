<script>
    import { ConfirmAddon, get_popup_manager, hide_popup } from "../../../lib/store/popup";

    // props
    export let key = "default";

    // components
    import PopupRenderer from "./popup-renderer.svelte";

    let manager = get_popup_manager(key);
    let active_popup = manager.active;
    let container = null;

    $: active_elements = get_visible_elements();
    $: is_active = $active_popup != null;
    $: is_confirm = $active_popup?.popup instanceof ConfirmAddon;

    // update active on popup change
    $: if ($active_popup?.popup) {
        active_elements = get_visible_elements();
    }

    const handle_submit = (value) => {
        const values = value ? value : $active_popup.popup.get_values();
        const callback = $active_popup.popup.callback;

        // close popup first
        hide_popup(key);

        // and then use the stored callback if available
        if (callback) callback(values);
    };

    const handle_cancel = (value, check) => {
        // force submit on confirm instance
        if (is_confirm && check) {
            handle_submit(value);
            return;
        }

        // or just hide
        hide_popup(key);
    };

    const close_on_backdrop = (event) => {
        if (event.target == container) {
            handle_cancel();
        }
    };

    const update_element = (element_id, value) => {
        $active_popup?.popup?.update(element_id, value);

        // update active elements
        active_elements = get_visible_elements();
    };

    const toggle_button = (id, value, is_multiple) => {
        const element = $active_popup.popup.get_element(id);

        if (!element) {
            console.log("toggle_button(): failed to get", id);
            return;
        }

        let new_value;
        const is_selected = element.value.includes(value);

        if (is_multiple) {
            new_value = is_selected ? element.value.filter((v) => v != value) : [...element.value, value];
        } else {
            new_value = is_selected ? [] : [value];
        }

        update_element(id, new_value);
    };

    const get_visible_elements = () => {
        if (!$active_popup?.popup) {
            return [];
        }

        const elements = $active_popup.popup.get_elements();

        // skip bs if we have ConfirmAddon
        if ($active_popup.popup instanceof ConfirmAddon) {
            return elements;
        }

        const all_elements = elements.filter((el) => $active_popup.popup.should_show_element(el));
        const root_elements = all_elements.filter((el) => !el.parent);

        // build element hierarchy
        return root_elements.map((element) => ({
            ...element,
            children: all_elements.filter((child) => child.parent == element.id)
        }));
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={container} class="popup-container" class:show={is_active} onclick={close_on_backdrop}>
    {#if $active_popup}
        <div class="popup-content">
            {#each active_elements as element}
                {#if element.type == "container" || is_confirm}
                    <PopupRenderer {element} value={element.value} on_update={is_confirm ? handle_submit : update_element} on_toggle={toggle_button}>
                        {#if element.children?.length > 0}
                            {#each element.children as child}
                                <PopupRenderer element={child} value={child.value} on_update={update_element} on_toggle={toggle_button} />
                            {/each}
                        {/if}
                    </PopupRenderer>
                {:else}
                    <PopupRenderer {element} value={element.value} on_update={update_element} on_toggle={toggle_button} />
                    {#if element.children?.length > 0}
                        <div class="children-container">
                            {#each element.children as child}
                                <PopupRenderer element={child} value={child.value} on_update={update_element} on_toggle={toggle_button} />
                            {/each}
                        </div>
                    {/if}
                {/if}
            {/each}
            {#if $active_popup.popup.custom_action || !is_confirm}
                <div class="popup-actions actions-separator">
                    {#if $active_popup.popup.custom_action}
                        <button class="submit-btn" onclick={() => handle_submit($active_popup.popup.custom_submit)}
                            >{$active_popup.popup.custom_submit}</button
                        >
                        <button class="cancel-btn" onclick={() => handle_cancel($active_popup.popup.custom_cancel, true)}
                            >{$active_popup.popup.custom_cancel}</button
                        >
                    {:else if !is_confirm}
                        <button class="cancel-btn" onclick={() => handle_cancel()}>cancel</button>
                        <button class="submit-btn" onclick={() => handle_submit()}>submit</button>
                    {/if}
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
        max-width: 80%;
        overflow: hidden;
        overflow-y: scroll;
        margin-top: 50px;
    }

    .popup-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
    }

    .actions-separator {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #333;
    }

    .children-container {
        margin-left: 20px;
        margin-top: 10px;
    }
</style>
