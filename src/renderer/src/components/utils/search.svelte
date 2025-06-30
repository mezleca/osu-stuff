<script>
	// search svg
	import Search from "../icon/search-icon.svelte";

	let {
		value = $bindable(""),
		placeholder = "",
		callback = () => {}
	} = $props();

	$effect(() => {
		console.log("updating search value", value);
		if (value || value == "") {
			callback();
		}
	}); 
</script>

<div class="search-container">
	<Search />
	<input type="text" class="search-input" {placeholder} bind:value />
</div>
