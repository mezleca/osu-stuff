<script>
	import { collections, selected_collection, show_notification } from "../store";

	// components
	import VirtualList from "./utils/virtual-list.svelte";
	import BeatmapCard from "./cards/beatmap-card.svelte";

	export let all_beatmaps = [],
		key = crypto.randomUUID(),
		carrousel = true,
		height = 100,
		direction = "right",
		remove_callback = () => {};

	$: beatmaps = all_beatmaps;

	const handle_control = (type, beatmap) => {
		if (type == "add") {
			show_notification("todo");
		} else {
			remove_beatmap(beatmap.md5);
		}
	};

	const remove_beatmap = (hash) => {
		// remove beatmap from array
		if ($selected_collection?.name) {
			collections.remove_beatmap($selected_collection.name, hash);
		}
		remove_callback();
	};
</script>

<div class="beatmaps-container">
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<div class="beatmaps-header">
		<div class="results-count">{beatmaps?.length ?? 0} matches</div>
	</div>
	<VirtualList count={beatmaps?.length ?? 0} width="100%" height="100%" item_height={height} {carrousel} {key} {direction} let:index>
		<!-- get beatmap metadata from md5 hash -->
		{@const beatmap = beatmaps[index] ?? null}
		<!-- @TODO: sr is hardcoded to stable gamemode -->
		<BeatmapCard
			title={beatmap?.title ?? "unknown"}
			artist={beatmap?.artist ?? "unknown"}
			beatmapset_id={beatmap?.beatmapset_id ?? 0}
			star_rating={beatmap?.star_rating?.[0].nm ?? 0}
			bpm={beatmap?.bpm ?? 0}
			id={beatmap?.md5 ?? crypto.randomUUID()}
			local={beatmap?.local ?? false}
			control={(type) => handle_control(type, beatmap)}
		/>
	</VirtualList>
</div>

<style>
</style>
