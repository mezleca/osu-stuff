<script>
	// audio preview and remove / add
	import Controls from "../utils/controls.svelte";

	// props
	export let title,
		artist,
		id = 0,
		status,
		star_rating = 0,
		bpm = 0,
		beatmapset_id,
		local,
		background,
		control = () => {},
		extra = () => {};

	$: audio_url = beatmapset_id ? `https://b.ppy.sh/preview/${beatmapset_id}.mp3` : "";
	$: bg = background ? background : `https://assets.ppy.sh/beatmaps/${beatmapset_id}/covers/cover.jpg`;

	$: control_key = `${id}-${beatmapset_id}`;
</script>

<div class="small-card" style="--card-bg: url({bg});">
	<Controls {local} right={control} url={beatmapset_id ? audio_url : ""} key={control_key} />

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="info" on:click={extra}>
		<div class="title">{title ?? "unknown"}</div>
		<div class="subtitle">{artist ?? "unknown"}</div>
		<div class="stats">
			<span class="stat">{status ?? "unknown"}</span>
			<div class="right-stats" style="justify-self: end;">
				<span class="stars">{bpm ?? "unknown"} bpm</span>
				<span class="stars">★ {star_rating ?? "0.0"}</span>
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
		border: 2px solid rgb(68, 68, 68);
		border-radius: 6px;
		height: 90px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		will-change: transform, filter;
		transform: translateZ(0);
	}

	.small-card:hover {
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
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		border-radius: 8px;
		font-size: 11px;
		padding: 4px 6px;
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
</style>
