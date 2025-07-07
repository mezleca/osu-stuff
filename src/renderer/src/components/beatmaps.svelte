<script>
	import { collections, selected_collection, show_notification } from "../store";
	import { get_beatmap_data } from "../lib/beatmaps";

	// components
	import VirtualList from "./utils/virtual-list.svelte";
	import BeatmapCard from "./cards/beatmap-card.svelte";

	// props
	export let selected = {};
	export let all_beatmaps = [];
	export let key = crypto.randomUUID();
	export let carrousel;
	export let show_bpm;
	export let show_star_rating;
	export let max_width;
	export let height = 100;
	export let direction;
	export let remove_callback = () => {};

	$: beatmaps = all_beatmaps;

	const handle_control = (type, beatmap) => {
		if (type == "add") {
			show_notification("todo");
		} else {
			remove_beatmap(beatmap.md5);
		}
	};

	const remove_beatmap = (hash) => {
		if ($selected_collection?.name) {
			collections.remove_beatmap($selected_collection.name, hash);
		}
		remove_callback();
	};

	const update_selected = (index, list, beatmap) => {
		if (beatmap?.md5 != selected?.beatmap?.md5) {
			selected = { index, list, beatmap };
		}
	};

	$: if (all_beatmaps) {
		beatmaps = all_beatmaps;
	}
</script>

<div class="beatmaps-container">
	<div class="beatmaps-header">
		<div class="results-count">{beatmaps?.length ?? 0} matches</div>
	</div>

	<VirtualList count={beatmaps?.length ?? 0} width="100%" height="100%" item_height={height} {max_width} {carrousel} {key} {direction} let:index>
		{@const hash = beatmaps[index]}

		{#await get_beatmap_data(hash) then beatmap}
			{@const selected_index = selected?.index ?? -1}
			{@const is_selected = beatmaps[selected_index]?.md5 == beatmap?.md5}
			<BeatmapCard
				{beatmap}
				{show_bpm}
				{show_star_rating}
				selected={is_selected}
				control={(type) => handle_control(type, beatmap)}
				click={() => update_selected(index, beatmaps, beatmap)}
			/>
		{/await}
	</VirtualList>
</div>
