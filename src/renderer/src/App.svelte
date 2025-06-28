<script>
	import { onMount } from "svelte";
	import { active_tab, is_maximized, show_notification } from "./store";
	import { debounce } from "./lib/utils";
	import { get_collections } from "./lib/collections";

	// tab components
	import Collections from "./components/tabs/collections.svelte";
	import Discover from "./components/tabs/discover.svelte";
	import Browse from "./components/tabs/browse.svelte";

	import Index from "./components/tabs/index.svelte";
	import Header from "./components/header.svelte";
	import Config from "./components/tabs/config.svelte";
	import Notifications from "./components/utils/notifications.svelte";

	$: initialized = false;

	const toggle_maximized = async () => {
		const result = await window.extra.is_maximized();
		$is_maximized = result;
	};

	onMount(async () => {
		try {
			await get_collections();
		} catch (err) {
			console.log(err);
			show_notification({ type: "error", timeout: 500, text: `failed to initialize\n${err}` });
		}

		initialized = true;
	});

	// disable window border on fullscreen
	window.addEventListener("resize", debounce(toggle_maximized, 50));
</script>

<main>
	<div class="window-border" class:show={!$is_maximized}></div>
	<!-- notification container -->
	<Notifications />
	<!-- show loading screen -->
	{#if !initialized}
		<div class="loading-screen">
			<div class="spinner"></div>
			<h1 class="loading-status" style="color: white;">loading...</h1>
		</div>
	{/if}
	<!-- show tabs header -->
	<Header active={initialized} />
	<!-- render active tab -->
	<div class="main-container">
		{#if $active_tab == "collections"}
			<Collections />
		{:else if $active_tab == "browse"}
			<Browse />
		{:else if $active_tab == "discover"}
			<Discover />
		{:else if $active_tab == "radio"}
			<button>radio</button>
		{:else if $active_tab == "config"}
			<Config />
		{:else if $active_tab == "status"}
			<button>status</button>
		{:else}
			<Index />
		{/if}
	</div>
</main>
