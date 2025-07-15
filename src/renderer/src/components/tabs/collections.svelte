<script>
	import { collections, collection_search, selected_collection, selected_collection_name } from "../../lib/store/collections";
	import { DEFAULT_SORT_OPTIONS, DEFAULT_STATUS_TYPES } from "../../lib/store/other";
	import { get_beatmap_list } from "../../lib/store/beatmaps";
	import { onMount } from "svelte";

	// components
	import Add from "../utils/add.svelte";
	import Search from "../utils/search.svelte";
	import CollectionCard from "../cards/collection-card.svelte";
	import Beatmaps from "../beatmaps.svelte";
	import Popup from "../utils/popup.svelte";
	import Dropdown from "../utils/dropdown.svelte";
	import ExpandableMenu from "../utils/expandable-menu.svelte";
	import RangeSlider from "../utils/range-slider.svelte";

	let filtered_collections = [];
	let is_popup_enabled = false;

	const FILTER_TYPES = [...DEFAULT_SORT_OPTIONS, "length"];
	const STATUS_TYPES = DEFAULT_STATUS_TYPES;

	const list = get_beatmap_list("collections");
	const { sort, query } = list;

	$: all_collections = collections.all;

	const filter_collection = () => {
		if ($collection_search == "") {
			filtered_collections = $all_collections;
		} else {
			filtered_collections = $all_collections.filter((obj) => obj.name.toLowerCase().includes($collection_search.toLowerCase()));
		}
	};

	const filter_beatmaps = async (extra) => {
		const result = await list.get_beatmaps($selected_collection_name, $query, extra);
		list.set_beatmaps(result, $query, false);
	};

	// force list update
	const update_sr = async (data) => {
		list.update_range(data);
		filter_beatmaps();
	};

	const remove_callback = () => {
		if ($selected_collection_name) {
			filter_beatmaps();
		}
		filter_collection();
	};

	$: if ($collection_search) {
		filter_collection();
	}

	$: if ($selected_collection_name || $query || $sort) {
		filter_beatmaps();
	}

	onMount(() => {
		if ($sort == "") $sort = "artist";
		filter_collection();
	});
</script>

<!-- @TODO: move css from app.cs to here -->
<div class="content tab-content">
	<!-- more options -->
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
						callback={() => collections.select(collection.name)}
					/>
				{/each}
			{/if}
		</div>
	</div>
	<div class="manager-content">
		<Add callback={() => (is_popup_enabled = true)} />
		<div class="content-header">
			<!-- current beatmap search -->
			<Search bind:value={$query} placeholder="search beatmaps" />
			<ExpandableMenu>
				<Dropdown bind:selected_value={$sort} options={FILTER_TYPES} />
				<Dropdown placeholder={"status"} options={STATUS_TYPES} />
				<RangeSlider on_update={update_sr} />
			</ExpandableMenu>
		</div>
		<!-- render beatmap list -->
		<Beatmaps carousel={true} tab_id={"collections"} {remove_callback} direction={"right"} />
	</div>
</div>

<style>
	.collections p {
		text-align: center;
	}
</style>
