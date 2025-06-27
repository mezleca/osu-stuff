<script>
	// audio preview and remove / add
	import Controls from "../utils/controls.svelte";

	// props
	export let title,
		artist,
		id,
		status,
		star_rating,
		beatmapset_id,
		local,
		downloaded,
		background,
		control = () => {},
		extra = () => {};

	const audio_url = beatmapset_id ? `https://b.ppy.sh/preview/${beatmapset_id}.mp3` : "";
	const actual_background = background ? background : `https://assets.ppy.sh/beatmaps/${beatmapset_id}/covers/cover.jpg`;
</script>

<!-- @TODO: small / normal type -->
<div class="small-card" style="background-image: url({actual_background});">
	<Controls {local} right={control} url={beatmapset_id ? audio_url : ""} />
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="info" on:click={extra}>
		<div class="title">{title || "unknown"}</div>
		<div class="subtitle">{artist || "unknown"}</div>
		<div class="stats">
			<span class="stat">{status || "unknown"}</span>
			<span class="stars">★ {star_rating || "0.0"}</span>
		</div>
	</div>
</div>
