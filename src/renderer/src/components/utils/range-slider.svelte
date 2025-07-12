<script>
	import { onMount, tick } from "svelte";

	export let min = 2;
	export let max = 8;

	let container;

	const update_fill = () => {
		if (!container) {
			return;
		}

		const min_percent = (min / 10) * 100;
		const max_percent = (max / 10) * 100;
		const thumb_offset = 16;
		const container_width = container.offsetWidth;
		const thumb_percent_offset = (thumb_offset / container_width) * 100;

		const fill = container.querySelector(".fill");
		const min_thumb = container.querySelector(".min-thumb");
		const max_thumb = container.querySelector(".max-thumb");

		if (fill) {
			fill.style.left = `${min_percent}%`;
			fill.style.width = `${max_percent - min_percent}%`;
		}

		if (min_thumb) {
			const safe_min = Math.max(thumb_percent_offset, min_percent);
			min_thumb.style.left = `calc(${safe_min}% - 16px)`;
		}

		if (max_thumb) {
			const safe_max = Math.min(100 - thumb_percent_offset, max_percent);
			max_thumb.style.left = `calc(${safe_max}% - 16px)`;
		}
	};

	const handle_min = (e) => {
		const new_min = parseFloat(e.target.value);
		if (new_min <= max) {
			min = new_min;
		}
	};

	const handle_max = (e) => {
		const new_max = parseFloat(e.target.value);
		if (new_max >= min) {
			max = new_max;
		}
	};

	$: if (min || max) {
		update_fill();
	}

	onMount(() => {
		tick().then(() => {
			update_fill();
		});
	});

	// @TODO: move this to somewhere else
	window.addEventListener("resize", update_fill);
</script>

<div bind:this={container} class="slider-container">
	<div class="track"></div>
	<div class="fill"></div>
	<input type="range" min="0" max="10" step="0.1" value={min} on:input={handle_min} class="range-input" />
	<input type="range" min="0" max="10" step="0.1" value={max} on:input={handle_max} class="range-input" />
	<div class="min-thumb">{min}</div>
	<div class="max-thumb">{max}</div>
</div>

<style>
	.slider-container {
		position: relative;
		width: 100%;
		height: 32px;
		padding: 0 16px;
		box-sizing: border-box;
	}

	.track {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 32px;
		background: transparent;
		border-radius: 4px;
		border: 2px solid var(--accent-color-half);
		z-index: 3;
		pointer-events: none;
	}

	.fill {
		position: absolute;
		top: 0;
		height: 32px;
		background: linear-gradient(to right, var(--accent-color) 0%, var(--accent-color-half) 100%);
		border-radius: 4px;
		z-index: 1;
	}

	.range-input {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 32px;
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
		cursor: pointer;
		z-index: 2;
	}

	.range-input::-webkit-slider-track {
		background: transparent;
	}

	.range-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 32px;
		height: 32px;
		background: #fff;
		border: 2px solid #333;
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.min-thumb,
	.max-thumb {
		position: absolute;
		top: 0;
		width: 32px;
		height: 32px;
		background: #fff;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: bold;
		color: #333;
		pointer-events: none;
		z-index: 3;
	}
</style>
