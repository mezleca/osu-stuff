<script>
	import { current_search } from "../../store";
	import Add from "../utils/add.svelte";
	import Search from "../utils/search.svelte";
</script>

<div class="content tab-content">
	<div class="manager-content">
		<div class="content-header">
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
			<Add />
			<div class="manager-beatmaps-container"></div>
		</div>
	</div>
</div>
