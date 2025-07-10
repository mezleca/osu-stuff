<script>
	import { onMount } from "svelte";
	import { get_filtered_beatmaps } from "../../lib/beatmaps";
	import { collections, radio_mode, radio_search, radio_sort, radio_selected, DEFAULT_SORT_OPTIONS } from "../../store";
	import { format_time, get_image_url } from "../../lib/utils";

	// components
	import Search from "../utils/search.svelte";
	import Controls from "../utils/controls.svelte";
	import Beatmaps from "../beatmaps.svelte";
	import Dropdown from "../utils/dropdown.svelte";

	// misc
	import PlaceholderImg from "../../assets/placeholder.png";

	$: all_collections = collections.all || [];
	$: beatmap_options = ["all beatmaps", ...$all_collections.map((c) => c.name)];

	// current beatmap data
	$: beatmap = $radio_selected?.beatmap ?? {};
	$: control_key = beatmap.md5 ?? crypto.randomUUID();
	$: bg = PlaceholderImg;
	$: filtered_maps = [];

	const update_background_image = () => {
		if ($radio_selected?.beatmap && $radio_selected?.beatmap?.image_path) {
			get_image_url($radio_selected.beatmap.image_path).then((url) => (bg = url));
		} else {
			bg = PlaceholderImg;
		}
	};

	const update_filtered_maps = async () => {
		filtered_maps =
			$radio_mode == "all beatmaps"
				? await get_filtered_beatmaps(null, $radio_search, { unique: true, sort: $radio_sort })
				: await get_filtered_beatmaps($radio_mode, $radio_search, { unique: false, $radio_sort });
	};

	$: if ($radio_mode || $radio_search || $radio_sort) {
		update_filtered_maps();
	}

	// update on change
	$: if ($radio_selected) {
		update_background_image();
	}

	onMount(() => {
		if (!$radio_mode) {
			$radio_mode = "all beatmaps";
		}

		// update background on mount
		update_background_image();
	});
</script>

<div class="content tab-content">
	<div class="radio-container" style="--radio-bg: url({bg});">
		<div class="sidebar">
			<div class="sidebar-header">
				<Search bind:value={$radio_search} placeholder="search beatmaps" />
				<div class="filter-container">
					<Dropdown bind:selected_value={$radio_mode} options={beatmap_options} />
					<Dropdown bind:selected_value={$radio_sort} options={DEFAULT_SORT_OPTIONS} />
				</div>
			</div>

			<Beatmaps
				bind:selected={$radio_selected}
				carrousel={true}
				key={$radio_mode}
				all_beatmaps={filtered_maps}
				show_bpm={false}
				max_width={true}
				direction="left"
			/>
		</div>

		<div class="radio-data">
			<div class="radio-beatmap">
				<div class="radio-beatmap-header">
					<div class="status">playing</div>
					<div class="status">★ {beatmap.star_rating?.[beatmap.mode]?.nm ?? "0.0"}</div>
				</div>

				<div class="song-info">
					<div class="title">{beatmap.title || "No song selected"}</div>
					<div class="artist">{beatmap.artist || ""}</div>
				</div>

				<div class="stats">
					<div class="stat">
						<div class="stat-label">BPM</div>
						<div class="stat-value">{beatmap.bpm || "---"}</div>
					</div>
					<div class="stat">
						<div class="stat-label">DURATION</div>
						<div class="stat-value">{beatmap.duration ? format_time(beatmap.duration) : "---"}</div>
					</div>
					<div class="stat">
						<div class="stat-label">MAPPED BY</div>
						<div class="stat-value">{beatmap.mapper || "---"}</div>
					</div>
				</div>

				<div class="radio-controls">
					{#key control_key}
						<Controls {beatmap} small={false} key={control_key} />
					{/key}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.radio-container {
		width: 100%;
		height: 100%;
		overflow: hidden;
		display: flex;
	}

	.sidebar {
		min-width: 400px;
		max-width: 40%;
		z-index: 1;
		background-color: rgba(18, 18, 18, 0.95);
	}

	.filter-container {
		display: flex;
		justify-content: space-around;
		gap: 10px;
	}

	.radio-data {
		flex: 1;
		position: relative;
		overflow: hidden;
		padding: 20px;
		background-color: rgba(18, 18, 18, 0.95);
		z-index: 1;
	}

	.radio-beatmap {
		background: var(--bg-tertiary);
		backdrop-filter: blur(15px);
		border-radius: 4px;
		padding: 24px;
		width: 100%;
		height: 100%;
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-rows: auto auto auto 1fr auto;
		gap: 24px;
	}

	.radio-beatmap::before {
		content: "";
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image: var(--radio-bg);
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		opacity: 1;
		filter: brightness(0.05);
		transition: all 0.3s;
	}

	.radio-beatmap-header {
		display: flex;
		justify-content: space-between;
		padding-bottom: 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.status {
		color: var(--text-color);
		font-size: 12px;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.song-info .title {
		font-size: 24px;
		color: #ffffff;
		margin-bottom: 8px;
	}

	.song-info .artist {
		font-size: 18px;
		color: var(--text-muted);
	}

	.stats {
		display: flex;
		justify-content: space-between;
		gap: 24px;
		padding: 16px;
		background: rgba(19, 19, 19, 0.8);
		border-radius: 4px;
	}

	.stat {
		text-align: center;
		flex: 1;
	}

	.stat:not(:last-child) {
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		padding-right: 12px;
	}

	.stat-label {
		color: #666;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 8px;
	}

	.stat-value {
		color: #ffffff;
		font-size: 16px;
	}

	.radio-controls {
		align-self: end;
	}
</style>
