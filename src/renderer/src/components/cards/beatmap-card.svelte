<script>
	// audio preview and remove / add
	import Controls from "../utils/controls.svelte";

	// props
	export let selected = false, beatmap = {}, show_bpm = true, show_star_rating = true, click = () => {}, control = () => {}, extra = () => {};

	$: audio_url = beatmap?.beatmapset_id ? `https://b.ppy.sh/preview/${beatmap?.beatmapset_id}.mp3` : "";
	$: bg = beatmap?.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${beatmap?.beatmapset_id}/covers/cover.jpg` : "";
	$: control_key = Date.now();

	// update more info we changed anything
	$: if (beatmap?.beatmapset_id) {
		audio_url = beatmap?.beatmapset_id ? `https://b.ppy.sh/preview/${beatmap?.beatmapset_id}.mp3` : "";
		bg = beatmap?.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${beatmap?.beatmapset_id}/covers/cover.jpg` : "";
	}

	// update key if we changed the beatmap
	$: if (beatmap?.md5) {
		control_key = beatmap?.md5;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="small-card" class:selected style="--card-bg: url({bg});" onclick={click}>
	{#key control_key}
		<Controls {beatmap} right={control} key={control_key} />
	{/key}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="info" onclick={extra}>
		<div class="title">{beatmap?.title ?? "unknown"}</div>
		<div class="subtitle">{beatmap?.artist ?? "unknown"}</div>
		<div class="stats">
			<span class="stat">{beatmap?.status_text ?? "unknown"}</span>
			<div class="right-stats" style="justify-self: end;">
				{#if show_bpm}
					<span class="stars">{Math.round(beatmap.bpm) ?? "unknown"} bpm</span>
				{/if}
				{#if show_star_rating}
					<span class="stars">★ {beatmap?.star_rating?.[beatmap.mode].nm ?? "0.0"}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.small-card {
		position: relative;
		display: flex;
		overflow: hidden;
		cursor: pointer;
		border: 2px solid transparent;
		border-radius: 6px;
		height: 90px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		will-change: transform, filter;
		transform: translateZ(0);
	}

	.small-card:hover,
	.selected {
		border-color: var(--accent-color);
	}

	.small-card::before {
		content: "";
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background-image: var(--card-bg);
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		opacity: 1;
	}

	.small-card .info {
		position: relative;
		z-index: 2;
		flex: 1;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		background: rgba(17, 20, 31, 0.6);
	}

	.small-card .title {
		font-size: 14px;
		color: var(--text-color);
		margin-bottom: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 300px;
	}

	.small-card .subtitle {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 320px;
	}

	.small-card .stars,
	.small-card .stat {
		color: var(--text-secondary);
		border-radius: 6px;
		font-size: 11px;
		padding: 4px 6px;
	}

	.small-card .stat {
		background: rgb(23, 23, 23, 0.65);
	}

	.small-card .stats {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.small-card .stat {
		text-transform: uppercase;
	}

	.small-card .stars {
		color: var(--accent-pink);
		font-size: 11px;
	}

	.right-stats {
		position: absolute;
		right: 15px;
	}

	.small-card:hover :global(.small-control-icon) {
		opacity: 1;
	}
</style>
