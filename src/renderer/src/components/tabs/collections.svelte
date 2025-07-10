<script>
	import {
		collection_beatmaps_search,
		selected_collection,
		collections,
		collection_search,
		selected_collection_name,
		DEFAULT_SORT_OPTIONS,
		DEFAULT_STATUS_TYPES
	} from "../../store";

	import { get_filtered_beatmaps } from "../../lib/beatmaps";
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

	let filtered_maps = [];
	let filtered_collections = [];
	let is_popup_enabled = false;

	const FILTER_TYPES = [...DEFAULT_SORT_OPTIONS, "length"];
	const STATUS_TYPES = DEFAULT_STATUS_TYPES;

	$: all_collections = collections.all;
	$: collections_sort = "";

	const filter_collection = () => {
		if ($collection_search == "") {
			filtered_collections = $all_collections;
		} else {
			filtered_collections = $all_collections.filter((obj) => obj.name.toLowerCase().includes($collection_search.toLowerCase()));
		}
	};

	const filter_beatmaps = async () => {
		filtered_maps = await get_filtered_beatmaps($selected_collection_name, $collection_beatmaps_search, {
			unique: false,
			sort: collections_sort != "" ? collections_sort : null
		});
	};

	const remove_callback = () => {
		if ($selected_collection_name) {
			filter_beatmaps();
		}
		filter_collection();
	};

	$: if ($collection_search != undefined) {
		filter_collection();
	}

	$: if ($selected_collection_name || $collection_beatmaps_search) {
		filter_beatmaps();
	}

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
			<Search bind:value={$collection_beatmaps_search} placeholder="search beatmaps" />
			<ExpandableMenu>
				<Dropdown placeholder={"sort by"} options={FILTER_TYPES} />
				<Dropdown placeholder={"status"} options={STATUS_TYPES} />
				<RangeSlider min={0} max={10} />
			</ExpandableMenu>
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
