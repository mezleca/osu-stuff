<script>
    import { onMount } from "svelte";
    import { get_popup_manager, hide_popup } from "../../../lib/store/popup";

    // props
    export let key = "default";

    // components
    import PopupRenderer from "./popup-renderer.svelte";

    let manager;
    let active_popup = null;
    let container = null;

    $: element_values = {};
    $: visible_elements = get_visible_elements(element_values);
    $: is_active = active_popup != null;

    // sync store values
    $: if (active_popup?.popup) {
        active_popup.popup.elements.forEach((element) => {
            const store = active_popup.popup.stores.get(element.id);
            if (store) {
                store.subscribe((value) => {
                    // console.log("updating", element.id, value);
                    element_values[element.id] = value;
                    element_values = { ...element_values };
                });
            }
        });
    }

    const handle_submit = () => {
        const values = active_popup.popup.get_values();
        const callback = active_popup.popup.callback;

        // close popup first
        hide_popup(key);

        // and then use the stored callback if available
        if (callback) callback(values);
    };

    const handle_cancel = () => {
        hide_popup(key);
    };

    const close_on_backdrop = (event) => {
        if (event.target == container) {
            handle_cancel();
        }
    };

    const update_element = (element_id, value) => {
        active_popup?.popup?.update_store(element_id, value);
    };

    const toggle_button = (element_id, option_value, is_multiple) => {
        const current = active_popup.popup.get_store_value(element_id) || [];
        let new_value;

        if (is_multiple) {
            const is_selected = current.includes(option_value);
            new_value = is_selected ? current.filter((v) => v != option_value) : [...current, option_value];
        } else {
            new_value = current.includes(option_value) ? [] : [option_value];
        }

        update_element(element_id, new_value);
    };

    const get_visible_elements = () => {
        if (!active_popup?.popup) {
            return [];
        }

        const all_elements = active_popup.popup.elements.filter((el) => active_popup.popup.should_show_element(el));
        const root_elements = all_elements.filter((el) => !el.parent);

        // build hierarchy
        return root_elements.map((element) => ({
            ...element,
            children: all_elements.filter((child) => child.parent == element.id)
        }));
    };

    onMount(() => {
        manager = get_popup_manager(key);

        // subscribe to popup changes
        const unsubscribe = manager.get_active().subscribe((popup) => {
            active_popup = popup;
        });

        return unsubscribe;
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={container} class="popup-container" class:show={is_active} on:click={close_on_backdrop}>
    {#if active_popup}
        <div class="popup-content">
            {#each visible_elements as element}
                {#if element.type == "container"}
                    <PopupRenderer {element} value={element_values[element.id]} on_update={update_element} on_toggle={toggle_button}>
                        {#if element.children?.length > 0}
                            {#each element.children as child}
                                <PopupRenderer
                                    element={child}
                                    value={element_values[child.id]}
                                    on_update={update_element}
                                    on_toggle={toggle_button}
                                />
                            {/each}
                        {/if}
                    </PopupRenderer>
                {:else}
                    <PopupRenderer {element} value={element_values[element.id]} on_update={update_element} on_toggle={toggle_button} />

                    {#if element.children?.length > 0}
                        <div class="children-container">
                            {#each element.children as child}
                                <PopupRenderer
                                    element={child}
                                    value={element_values[child.id]}
                                    on_update={update_element}
                                    on_toggle={toggle_button}
                                />
                            {/each}
                        </div>
                    {/if}
                {/if}
            {/each}

            <div class="popup-actions">
                <button class="cancel-btn" on:click={handle_cancel}>cancel</button>
                <button class="submit-btn" on:click={handle_submit}>submit</button>
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
        margin-top: 50px;
    }

    .popup-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #333;
    }

    .children-container {
        margin-left: 20px;
        margin-top: 10px;
    }
</style>
