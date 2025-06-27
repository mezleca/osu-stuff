<script>
	import { current_search, selected_collection, collection_beatmaps, collections, show_notification } from "../../store";
	import { osu_beatmaps } from "../../store";

	// for beatmap list
	import VirtualList from "../utils/virtual-list.svelte";

	// components
	import Add from "../utils/add.svelte";
	import Search from "../utils/search.svelte";
	import CollectionCard from "../cards/collection-card.svelte";
	import BeatmapCard from "../cards/beatmap-card.svelte";
	import SearchIcon from "../icon/search-icon.svelte";
	import Popup from "../utils/popup.svelte";

	$: all_collections = collections.all || [];
	$: current_collection_beatmaps = $collection_beatmaps || [];
	$: is_popup_enabled = false;

	const select_collection = (collection) => {
		collections.select(collection.name);
	};

	const remove_beatmap = (beatmap_id) => {
		if ($selected_collection?.name) {
			collections.remove_beatmap($selected_collection.name, beatmap_id);
		}
	};
</script>

<div class="content tab-content">
	<!-- collection more options -->
	<Popup bind:active={is_popup_enabled}>
		<h1>hello bro</h1>
	</Popup>
	<div class="sidebar">
		<div class="sidebar-header">
			<div class="search-box">
				<SearchIcon />
				<input type="text" class="search-input" placeholder="search collections..." />
			</div>
		</div>
		<div class="collections">
			<!-- show collections -->
			{#each $all_collections as collection}
				<CollectionCard
					name={collection.name}
					count={collection.maps.size || 0}
					selected={$selected_collection?.name == collection.name}
					callback={() => select_collection(collection)}
				/>
			{/each}
		</div>
	</div>
	<div class="manager-content">
		<div class="content-header">
			<!-- current beatmap search -->
			<Search bind:value={$current_search} placeholder="search beatmaps" />
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
				<div class="results-count">{current_collection_beatmaps.length} matches</div>
			</div>
			<VirtualList items={current_collection_beatmaps} width="100%" height="100%" item_height={100} mimic_osu={true} let:item>
				{@const beatmap = $osu_beatmaps.get(item)}
				<BeatmapCard
					title={beatmap?.title ?? "unknown"}
					artist={beatmap?.artist ?? "unknown"}
					beatmapset_id={beatmap?.beatmapset_id || 0}
					id={item}
					local={beatmap?.local ?? false}
					control={() => remove_beatmap(item)}
				/>
			</VirtualList>
		</div>
	</div>
</div>
