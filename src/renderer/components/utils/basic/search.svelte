<script lang="ts">
    import { block_global_shortcuts } from "../../../lib/actions/input";
    import { string_is_valid } from "../../../lib/utils/utils";

    // search svg
    import Search from "../../icon/search-icon.svelte";

    interface Props {
        value?: string;
        placeholder?: string;
        callback?: ((value: string) => void) | null;
    }

    let element: HTMLInputElement = null;

    let { value = $bindable(""), placeholder = "", callback = null }: Props = $props();

    const handle_keydown = (event: KeyboardEvent) => {
        if (event.key != "Escape") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        element.blur();
    };

    $effect(() => {
        if (!string_is_valid(value)) {
            return;
        }

        if (callback) {
            callback(value);
        }
    });
</script>

<div class="search-container">
    <Search />
    <input {placeholder} class="search-input" type="text" bind:this={element} bind:value use:block_global_shortcuts onkeydown={handle_keydown} />
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
