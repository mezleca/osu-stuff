<script>
	import { onMount } from "svelte";

	// props
	export let count = 0;
	export let item_height = 100;
	export let buffer = 5;
	export let height = "100%";
	export let carrousel = false;
	export let key = "";
	export let direction = "right";

	let container;
	let scroll_top = 0;
	let container_height = 0;
	let hovered_item = -1;
	let selection_focus_offset = 0;
	let selected_item = -1;

	$: total_height = count * item_height;
	$: start_index = Math.max(0, Math.floor(scroll_top / item_height) - buffer);
	$: visible_count = Math.ceil(container_height / item_height) + buffer * 2;
	$: end_index = Math.min(start_index + visible_count, count);
	$: visible_items = end_index - start_index;
	$: offset_y = start_index * item_height;

	const lerp = (start, end, factor) => start + (end - start) * factor;

	const update_carrousel_effect = () => {
		if (!carrousel || !container) {
			return;
		}

		const center_y = scroll_top + container_height / 2;
		const elements = [...container.querySelectorAll(".item")];

		// update selection focus offset (moves non selected items to right)
		const target_offset = selected_item >= 0 ? 60 : 0;
		selection_focus_offset = lerp(selection_focus_offset, target_offset, 0.1);

		for (let i = 0; i < elements.length; i++) {
			const element = elements[i];

			const item_index = start_index + i;
			const item_center_y = item_index * item_height + item_height / 2;
			const distance_from_center = Math.abs(item_center_y - center_y);
			const normalized_distance = distance_from_center / item_height;
			const is_hovered = hovered_item == item_index;

			let scale = 1,
				x_offset = 0,
				margin = 0;

			if (normalized_distance <= 0.5) {
				scale = 1;
			} else if (normalized_distance <= 2.0) {
				const fade_factor = (normalized_distance - 0.5) / 1.5;
				scale = lerp(1, 0.95, fade_factor);
			} else {
				scale = 0.95;
			}

			// selection focus effect (move non-selected items right)
			if (selection_focus_offset > 0) {
				x_offset = selection_focus_offset;
			}

			// hover effect
			if (is_hovered) {
				scale = Math.min(scale * 1.01, 1.05);
				margin = Math.min(2, 8);
			}

			const height_px = Math.round(item_height * scale);
			element.style.height = height_px + "px";

			// apply transforms
			element.style.setProperty("--scale-x", scale);
			element.style.setProperty("--x-offset", `${x_offset}px`);
			element.style.setProperty("--margin", `${margin}px`);
		}
	};

	const handle_scroll = (e) => {
		scroll_top = e.target.scrollTop;
		if (carrousel) {
			requestAnimationFrame(update_carrousel_effect);
		}
	};

	const handle_mouse_enter = (index) => {
		hovered_item = index;
		if (carrousel) {
			requestAnimationFrame(update_carrousel_effect);
		}
	};

	const handle_mouse_leave = () => {
		hovered_item = -1;
		if (carrousel) {
			requestAnimationFrame(update_carrousel_effect);
		}
	};

	const update_height = () => {
		if (container) {
			container_height = container.clientHeight;
			if (carrousel) {
				requestAnimationFrame(update_carrousel_effect);
			}
		}
	};

	// update when visible items change
	$: if (visible_items > 0 && carrousel) {
		requestAnimationFrame(update_carrousel_effect);
	}

	// update
	$: if (container && (count == 0 || key)) {
		hovered_item = -1;
		selected_item = -1;
	}

	export const scroll_to_item = (index) => {
		if (container && index >= 0 && index < count) {
			const target_scroll = index * item_height - container_height / 2 + item_height / 2;
			container.scrollTo({
				top: Math.max(0, target_scroll),
				behavior: "smooth"
			});
		}
	};

	export const get_center_item_index = () => {
		return Math.round((scroll_top + container_height / 2) / item_height);
	};

	onMount(() => {
		if (container) container.scrollTop = 0;
		scroll_top = 0;
		update_height();
	});
</script>

<svelte:window on:resize={update_height} />

<div
	bind:this={container}
	class="virtual-list"
	class:osu-mode={carrousel}
	style="height: {height};"
	on:scroll={handle_scroll}
	bind:clientHeight={container_height}
>
	<div class="spacer" style="height: {total_height}px;"></div>
	<div class="viewport" style="transform: translateY({offset_y}px);">
		{#key key}
			{#each { length: visible_items } as _, i (start_index + i)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="item {direction}"
					class:osu-effect={carrousel}
					class:selected={selected_item === start_index + i}
					style="height: {item_height}px; transform-origin: {direction} center; justify-self: {direction};"
					on:mouseenter={() => handle_mouse_enter(start_index + i)}
					on:mouseleave={handle_mouse_leave}
					role="button"
					tabindex="0"
				>
					<slot index={start_index + i} />
				</div>
			{/each}
		{/key}
	</div>
</div>

<style>
	.virtual-list {
		position: relative;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.spacer {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		pointer-events: none;
	}

	.viewport {
		position: absolute;
		top: 0;
		left: auto;
		right: 0;
		will-change: transform;
		width: 100%;
	}

	.item {
		width: 80%;
		cursor: pointer;
	}

	.osu-effect {
		transform: translateZ(0) scaleX(var(--scale-x, 1)) translateX(var(--x-offset, 0));
		backface-visibility: hidden;
		outline: 1px solid transparent;
		transition:
			transform 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
			opacity 150ms ease-out,
			margin 100ms ease-out;
		will-change: transform;
		margin-left: var(--margin, 0px);
	}

	.osu-mode {
		transform: translateZ(0);
	}

	.selected {
		z-index: 10;
	}

	@media (max-width: 768px) {
		.virtual-list::-webkit-scrollbar {
			width: 4px;
		}
	}
</style>
