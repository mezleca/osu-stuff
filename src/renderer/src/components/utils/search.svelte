<script>
	// search svg
	import Search from "../icon/search-icon.svelte";

	export let value = "",
		placeholder = "";
</script>

<div class="search-container">
	<Search />
	<input type="text" class="search-input" {placeholder} bind:value />
</div>
