<script>
	import {
		collection_beatmaps_search,
		selected_collection,
		collection_beatmaps,
		collections,
		show_notification,
		collection_search
	} from "../../store";
	import { get_beatmap_data } from "../../lib/beatmaps";
	import { onMount } from "svelte";

	// for beatmap list
	import VirtualList from "../utils/virtual-list.svelte";

	// components
	import Add from "../utils/add.svelte";
	import Search from "../utils/search.svelte";
	import CollectionCard from "../cards/collection-card.svelte";
	import BeatmapCard from "../cards/beatmap-card.svelte";
	import Popup from "../utils/popup.svelte";

	$: all_collections = collections.all || [];
	$: filtered_maps = [];
	$: current_collection_beatmaps = $collection_beatmaps || [];
	$: is_popup_enabled = false;

	let filtered_collections = $all_collections;

	const filter_collection = () => {
		if ($collection_search == "") {
			filtered_collections = $all_collections;
		} else {
			filtered_collections = $all_collections.filter((obj) => obj.name.toLowerCase().includes($collection_search.toLowerCase()));
		}
	};

	// update matching_count on collection change
	$: matching_count = (() => {
		if (!$selected_collection || !current_collection_beatmaps.length) {
			return 0;
		}

		let matching = 0;
		let filtered = [];

		// loop through each md5 of our collection
		for (const hash of current_collection_beatmaps) {
			const data = get_beatmap_data(hash, $collection_beatmaps_search);

			if (data.filtered) {
				filtered.push(data.result);
				matching++;
			}
		}

		// update filtered list
		filtered_maps = filtered;
		return matching;
	})();

	const select_collection = (collection) => {
		collections.select(collection.name);
	};

	const remove_beatmap = (beatmap_id) => {
		// remove beatmap from array
		if ($selected_collection?.name) {
			collections.remove_beatmap($selected_collection.name, beatmap_id);
		}

		// to update collection count
		filter_collection();
	};

	onMount(() => {
		filter_collection();
	});
</script>

<!-- @TODO: move css from app.cs to here -->
<!-- @TODO: create a component to do all of the beatmaps list bullshit -->
<div class="content tab-content">
	<!-- collection more options -->
	<Popup bind:active={is_popup_enabled}>
		<h1>hello bro</h1>
	</Popup>
	<div class="sidebar">
		<div class="sidebar-header">
			<Search bind:value={$collection_search} placeholder="search collections" callback={filter_collection} />
		</div>
		<div class="collections">
			<!-- show collections -->
			{#if filtered_collections.length == 0}
				<p>${$filtered_collections.length} results</p>
			{:else}
				{#each filtered_collections as collection}
					<CollectionCard
						name={collection.name}
						count={collection.maps.length ?? 0}
						selected={$selected_collection?.name == collection.name}
						callback={() => select_collection(collection)}
					/>
				{/each}
			{/if}
		</div>
	</div>
	<div class="manager-content">
		<div class="content-header">
			<!-- current beatmap search -->
			<Search bind:value={$collection_beatmaps_search} placeholder="search beatmaps" />
			<div class="search-expand">
				<button class="expand-btn" id="expandBtn">⋯</button>
			</div>
			<div class="search-expanded" id="searchExpanded">
				<div class="browse-filters"></div>
			</div>
		</div>
		<div class="beatmaps-container">
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<Add callback={() => (is_popup_enabled = true)} />
			<div class="beatmaps-header">
				<div class="results-count">{matching_count} matches</div>
			</div>
			<VirtualList
				count={matching_count}
				width="100%"
				height="100%"
				item_height={100}
				carrousel={true}
				let:index
				key={$selected_collection?.name}
			>
				<!-- get beatmap metadata from md5 hash -->
				{@const beatmap = filtered_maps[index] ?? null}
				<!-- @TODO: sr is hardcoded to stable gamemode -->
				<BeatmapCard
					title={beatmap?.title ?? "unknown"}
					artist={beatmap?.artist ?? "unknown"}
					beatmapset_id={beatmap?.beatmapset_id ?? 0}
					star_rating={beatmap?.star_rating[0].nm ?? 0}
					bpm={beatmap?.bpm ?? 0}
					id={beatmap.md5}
					local={beatmap?.local ?? false}
					control={() => remove_beatmap(beatmap.md5)}
				/>
			</VirtualList>
		</div>
	</div>
</div>

<style>
	.collections p {
		text-align: center;
	}
</style>
