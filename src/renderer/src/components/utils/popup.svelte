<script>
	export let active = false;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="popup-container" on:click={() => (active = false)} class:show={active}>
	<slot />
</div>
