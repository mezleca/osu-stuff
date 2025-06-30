<script>
	import {
		collection_beatmaps_search,
		selected_collection,
		collections,
		collection_search,
		selected_collection_name
	} from "../../store";

	import { get_filtered_beatmaps } from "../../lib/beatmaps";
	import { onMount } from "svelte";

	// components
	import Add from "../utils/add.svelte";
	import Search from "../utils/search.svelte";
	import CollectionCard from "../cards/collection-card.svelte";
	import Beatmaps from "../beatmaps.svelte";
	import Popup from "../utils/popup.svelte";

	let all_collections = $derived(collections.all);
	let filtered_maps = $state([]);
	let filtered_collections = $state([]);
	let is_popup_enabled = $state(false);

	const filter_collection = () => {
		if ($collection_search == "") {
			filtered_collections = $all_collections;
		} else {
			filtered_collections = $all_collections.filter((obj) => obj.name.toLowerCase().includes($collection_search.toLowerCase()));
		}
	};

	const filter_beatmaps = () => {
		filtered_maps = get_filtered_beatmaps($selected_collection_name, $collection_beatmaps_search);
	};

	const select_collection = (collection) => {
		collections.select(collection.name);
	};

	const remove_callback = () => {
		filter_collection();
		if ($selected_collection_name) {
			filter_beatmaps();
		}
	};

	$effect(() => {
		if ($collection_search) {
			filter_collection();
		}
		if ($selected_collection_name || $collection_beatmaps_search) {
			filter_beatmaps();
		}
	});

	onMount(() => {
		filter_collection();
	});
</script>

<!-- @TODO: move css from app.cs to here -->
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
				<p>{filtered_collections.length} results</p>
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
		<Add callback={() => (is_popup_enabled = true)} />
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
		<!-- render beatmap list -->
		<Beatmaps carrousel={true} key={$selected_collection_name} all_beatmaps={filtered_maps} {remove_callback} direction={"right"} />
	</div>
</div>

<style>
	.collections p {
		text-align: center;
	}
</style>
