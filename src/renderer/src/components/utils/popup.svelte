<script>
	export let active = false;

	$: container = null;

	const remove_focus = (event) => {
		if (event.target != container) return;
		active = false;
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore slot_element_deprecated -->
<div bind:this={container} class="popup-container" onclick={remove_focus} class:show={active}>
	<slot />
</div>

<style>
	.popup-container {
		display: none;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		background-color: #20202067;
		animation: smooth-appear 0.15s ease forwards;
	}

	.popup-container.show {
		display: flex;
	}

	:global(.popup-content) {
		padding: 20px;
		border-radius: 6px;
		background-color: var(--bg-tertiary);
		border: 1px solid rgb(90, 90, 90, 0.5);
	}

	:global(.popup-content > label) {
		font-size: 0.9em;
	}
</style>