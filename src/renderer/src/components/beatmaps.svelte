<script>
	import { collections, selected_collection } from "../lib/store/collections";
	import { get_beatmap_list } from "../lib/store/beatmaps";
	import { show_notification } from "../lib/store/notifications";
	import { get_beatmap_data } from "../lib/utils/beatmaps";

	// components
	import VirtualList from "./utils/virtual-list.svelte";
	import BeatmapCard from "./cards/beatmap-card.svelte";

	// props
	export let tab_id;
	export let carousel;
	export let show_bpm;
	export let show_star_rating;
	export let selected_beatmap;
	export let max_width;
	export let height = 100;
	export let direction;
	export let remove_callback = () => {};

	const list = get_beatmap_list(tab_id);
	const { beatmaps, selected } = list;

	$: if ($selected) {
		selected_beatmap = $selected;
	}

	$: selected_index = $beatmaps && $selected ? $beatmaps.findIndex((hash) => hash == $selected.md5) : -1;

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

	const handle_click = (beatmap, index) => {
		list.select_beatmap(beatmap, index);
	};
</script>

<div class="beatmaps-container">
	<div class="beatmaps-header">
		<div class="results-count">{$beatmaps?.length ?? 0} matches</div>
	</div>
	<VirtualList
		count={$beatmaps?.length ?? 0}
		width="100%"
		height="100%"
		item_height={height}
		selected={selected_index}
		{max_width}
		{carousel}
		{tab_id}
		{direction}
		let:index
	>
		{@const hash = $beatmaps[index]}
		{#await get_beatmap_data(hash) then beatmap}
			<BeatmapCard
				{beatmap}
				{show_bpm}
				{show_star_rating}
				selected={$selected && (list.is_unique ? $selected.unique_id == beatmap.unique_id : $selected.md5 == beatmap.md5)}
				control={(type) => handle_control(type, beatmap)}
				click={() => handle_click(beatmap, index)}
			/>
		{/await}
	</VirtualList>
</div>
