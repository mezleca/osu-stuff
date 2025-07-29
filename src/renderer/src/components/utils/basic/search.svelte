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
