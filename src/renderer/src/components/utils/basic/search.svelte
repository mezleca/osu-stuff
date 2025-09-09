<script>
    // search svg
    import Search from "../../icon/search-icon.svelte";

    export let value = "";
    export let placeholder = "";
    export let callback = (value) => {};

    $: if (value != undefined) {
        callback(value);
    }
</script>

<div class="search-container">
    <Search />
    <input type="text" class="search-input" {placeholder} bind:value />
</div>

<style>
    .search-input {
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
