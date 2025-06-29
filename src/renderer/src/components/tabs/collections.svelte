<script>
	import {
		collection_beatmaps_search,
		selected_collection,
		collection_beatmaps,
		collections,
		show_notification,
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

	$: all_collections = collections.all || [];
	$: filtered_maps = [];
	$: is_popup_enabled = false;

	let filtered_collections = $all_collections;

	const filter_collection = () => {
		if ($collection_search == "") {
			filtered_collections = $all_collections;
		} else {
			filtered_collections = $all_collections.filter((obj) => obj.name.toLowerCase().includes($collection_search.toLowerCase()));
		}
	};

	$: if ($selected_collection_name || $collection_beatmaps_search) {
		filtered_maps = get_filtered_beatmaps($selected_collection_name, $collection_beatmaps_search);
	}

	const select_collection = (collection) => {
		collections.select(collection.name);
	};

	const remove_callback = () => {
		filter_collection();
		if ($selected_collection_name) {
			filtered_maps = get_filtered_beatmaps($selected_collection_name, $collection_beatmaps_search);
		}
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
