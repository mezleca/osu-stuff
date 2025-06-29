<script>
	import Search from "../utils/search.svelte";
	import PlaceholderImg from "../../assets/placeholder.png";
	import Controls from "../utils/controls.svelte";

	export let background;

	$: bg = background ?? PlaceholderImg;

	let value = "";
</script>

<div class="content tab-content">
	<div class="radio-container" style="--radio-bg: url({bg});">
		<div class="sidebar">
			<div class="sidebar-header">
				<Search value={value} placeholder="mhm"/>
			</div>
			<div class="radio-items">
				<h1>hello bro</h1>
			</div>
		</div>
		<div class="radio-data">
			<div class="radio-beatmap">
				<div class="radio-beatmap-header">
					<div class="status">something</div>
				</div>
				<div class="song-info">
					<div class="title">123</div>
					<div class="artist">123</div>
					<div class="diff">123</div>
					<div class="star-rating"></div>
				</div>
				<div class="mapper-section">
					<div class="mapper-icon"></div>
					<div class="mapper-details" style="flex: 1;">
						<div class="mapper-label">MAPPED BY</div>
						<div class="mapper-name">test</div>
					</div>
				</div>
				<div class="stats">
					<div class="stat">
						<div class="stat-label">BPM</div>
						<div class="stat-value">154</div>
					</div>
					<div class="stat">
						<div class="stat-label">LENGTH</div>
						<div class="stat-value">3:14</div>
					</div>
					<div class="stat">
						<div class="stat-label">CS</div>
						<div class="stat-value">4.2</div>
					</div>
					<div class="stat">
						<div class="stat-label">AR</div>
						<div class="stat-value">9.3</div>
					</div>
				</div>
				<div class="radio-controls">
					<div class="controls">
						<Controls small={false}/>
					</div>
				</div>
			</div>
			<!-- @TODO: floating control with floating player icons (random, no repeat or something )-->
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

	.radio-container .sidebar {
		max-width: 40%;
		z-index: 1;
		background-color: rgb(18, 18, 18, 0.95);
	}

	.radio-items {
		flex-grow: 1;
		width: 100%;
	}

	.radio-data {
		flex: 1;
		position: relative;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto 1fr;
		width: 100%;
		height: 100%;
		min-height: 0;
		padding: 20px;
		background-color: rgb(18, 18, 18, 0.95);
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
		overflow: hidden;
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		grid-template-rows: auto auto auto auto 1fr auto;
	}

	.radio-beatmap::before {
		content: "";
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background-image: var(--radio-bg);
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		opacity: 1;
		filter: brightness(0.05);
		will-change: filter background-image;
		transition: all 0.3s;
	}

	.radio-beatmap-header {
		margin-bottom: 28px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		padding-bottom: 16px;
		z-index: 1;
	}

	.radio-beatmap-header .status {
		color: var(--text-color);
		font-size: 12px;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.radio-beatmap .mapper-section {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 32px;
		padding: 16px;
		background: rgb(19, 19, 19, 0.8);
		border-radius: 4px;
		border-left: 2px solid var(--accent-color);
	}

	.radio-beatmap .stats {
		display: flex;
		justify-content: space-between;
		gap: 24px;
	}

	.radio-beatmap .stat {
		text-align: center;
		flex: 1;
	}

	.radio-beatmap .stats .stat:not(:last-child) {
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		padding-right: 12px;
	}

	.stats .stat .stat-label {
		color: #666;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 8px;
	}

	.mapper-label {
		color: #666;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 4px;
	}

	.mapper-name {
		color: #ffffff;
		font-size: 16px;
	}

	.song-info {
		margin-bottom: 32px;
	}

	.song-info .title {
		font-size: 24px;
		color: linear-gradient(135deg, #ffffff 0%, #cccccc 100%);
	}

	.song-info .artist {
		font-size: 18px;
		color: var(--text-muted);
	}

	.song-info .diff {
		font-size: 20px;
		color: var(--accent-color);
	}

	.radio-controls {
		padding: 24px;
		width: 100%;
		background: rgb(19, 19, 19, 0.8);
		border-radius: 4px;
		align-self: end;
	}

	.radio-controls .controls {

	}
</style>