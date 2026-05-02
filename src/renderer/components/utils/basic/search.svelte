<svelte:options runes={true} />

<script lang="ts">
    import { onMount } from "svelte";
    import { input } from "../../../lib/store/input";
    import { string_is_valid } from "../../../lib/utils/utils";
    import {
        blur_search_element,
        reset_search_state,
        set_search_element,
        set_search_focused,
        set_search_typing
    } from "../../../lib/store/other.svelte";

    // search svg
    import Search from "../../icon/search-icon.svelte";
    import { debounce } from "@shared/timing";

    interface Props {
        value?: string;
        placeholder?: string;
        callback?: ((value: string) => void) | null;
    }

    let element: HTMLInputElement = null;

    let { value = $bindable(""), placeholder = "", callback = null }: Props = $props();

    const reset_typing = debounce(() => set_search_typing(false), 50);

    $effect(() => {
        if (!string_is_valid(value)) {
            return;
        }

        if (callback) {
            callback(value);
        }

        reset_typing();
    });

    onMount(() => {
        set_search_element(element);

        const handle_blur_id = input.on("escape", () => {
            blur_search_element();
            reset_search_state();
            return true;
        });

        return () => {
            set_search_element(null);
            input.unregister(handle_blur_id);
        };
    });
</script>

<div class="search-container">
    <Search />
    <input
        {placeholder}
        class="search-input"
        type="text"
        bind:this={element}
        bind:value
        oninput={() => set_search_typing(true)}
        onfocus={() => set_search_focused(true)}
        onblur={reset_search_state}
    />
</div>

<style>
    .search-input {
        font-family: "Torus SemiBold";
        width: 100%;
        padding: 12px 16px 12px 45px;
        background: var(--tab-bg-color2);
        border: 1px solid var(--accent-color2);
        border-radius: 6px;
        color: #fff;
        font-size: 15px;
        outline: none;
        transition: all 0.2s ease;
        height: 48px;
    }

    .search-input:focus {
        border-color: var(--accent-color);
        box-shadow: 0 0 0 3px rgba(255, 64, 129, 0.1);
    }
</style>
