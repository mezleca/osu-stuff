<script>
	export let active = false;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore slot_element_deprecated -->
<div class="popup-container" onclick={() => (active = false)} class:show={active}>
	<slot />
</div>
