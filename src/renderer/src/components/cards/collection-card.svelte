<script>
	import Music from "../icon/music.svelte";
	let { name, count, selected, callback = () => {} } = $props();
</script>

<button class="collection-item" onclick={callback} class:active={selected == true}>
	<div class="collection-info">
		<Music />
		<span class="collection-name">{name}</span>
	</div>
	<span class="collection-count">{count} {count == 1 ? "map" : "maps"}</span>
</button>
