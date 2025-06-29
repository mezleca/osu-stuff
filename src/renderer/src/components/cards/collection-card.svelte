<script>
	import Music from "../icon/music.svelte";
	export let callback = () => {};
	export let name, count, selected;
</script>

<button class="collection-item" on:click={callback} class:active={selected == true}>
	<div class="collection-info">
		<Music />
		<span class="collection-name">{name}</span>
	</div>
	<span class="collection-count">{count} {count == 1 ? "map" : "maps"}</span>
</button>
