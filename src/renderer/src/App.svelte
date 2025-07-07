<script>
	import { onMount } from "svelte";
	import { active_tab, is_maximized, show_notification, indexing, indexing_data } from "./store";
	import { debounce } from "./lib/utils";
	import { get_collections } from "./lib/collections";

	// tabs
	import Collections from "./components/tabs/collections.svelte";
	import Discover from "./components/tabs/discover.svelte";
	import Browse from "./components/tabs/browse.svelte";
	import Radio from "./components/tabs/radio.svelte";
	import Config from "./components/tabs/config.svelte";
	import Index from "./components/tabs/index.svelte";

	// extra
	import Header from "./components/header.svelte";
	import Notifications from "./components/utils/notifications.svelte";

	$: initialized = false;

	$: indexing_status = $indexing_data?.status ?? "doing something";
	$: indexing_width = $indexing_data?.length ? ($indexing_data.index / $indexing_data.length) * 100 : 0;
	$: indexing_progress = $indexing_data?.text ?? "";
	$: indexing_small = $indexing_data?.small ?? "";
	
	const toggle_maximized = async () => {
		const result = await window.extra.is_maximized();
		$is_maximized = result;
	};

	onMount(async () => {
		get_collections()
			.then(() => initialized = true)
			.catch((err) => {
				console.log(err);
				show_notification({ type: "error", timeout: 5000, text: `failed to initialize\n${err}` });
			});
	});

	// disable window border on fullscreen
	window.addEventListener("resize", debounce(toggle_maximized, 50));
</script>

<main>
	<!-- @NOTE: if the app opens on fullscreen ts is still visible -->
	<div class="window-border" class:show={!$is_maximized}></div>

	<!-- notification container -->
	<Notifications />

	<!-- loading screen -->
	{#if !initialized}
		<div class="loading-screen">
			<div class="spinner"></div>
			<h1 class="loading-status" style="color: white;">loading...</h1>
		</div>
	{/if}

	<!-- indexing screen -->
	{#if $indexing}
		<div class="indexing-overlay">
			<div class="indexing-center">
				<div class="indexing-title">{indexing_status}</div>
				<div class="indexing-bar-container">
					<div class="indexing-bar" style="width: {indexing_width}%;"></div>
				</div>
				<div class="indexing-text">{indexing_progress}</div>
			</div>
			{#if indexing_data}
				<div class="indexing-bottom-text">{indexing_small}</div>
			{/if}
		</div>
	{/if}
	
	<!-- show tabs header -->
	<Header active={initialized && !$indexing} />

	<!-- render active tab -->
	<div class="main-container">
		{#if $active_tab == "collections"}
			<Collections />
		{:else if $active_tab == "browse"}
			<Browse />
		{:else if $active_tab == "discover"}
			<Discover />
		{:else if $active_tab == "radio"}
			<Radio />
		{:else if $active_tab == "config"}
			<Config />
		{:else if $active_tab == "status"}
			<button>status</button>
		{:else}
			<Index />
		{/if}
	</div>
</main>

<style>
.indexing-overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	background: rgba(20, 20, 20, 0.95);
	z-index: 1001;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
}
.indexing-center {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex: 1;
}
.indexing-title {
	color: #fff;
	font-size: 2rem;
	margin-bottom: 2rem;
	text-align: center;
}
.indexing-bar-container {
	width: 320px;
	height: 18px;
	background: #333;
	border-radius: 9px;
	overflow: hidden;
	margin-bottom: 1rem;
	box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.indexing-bar {
	height: 100%;
	background: var(--accent-color);
	transition: width 0.1s;
}
.indexing-text {
	color: #fff;
	font-size: 1.1rem;
	margin-bottom: 2rem;
	text-align: center;
}
.indexing-bottom-text {
	color: #aaa;
	font-size: 0.95rem;
	position: absolute;
	bottom: 32px;
	left: 0;
	width: 100vw;
	text-align: center;
	letter-spacing: 0.02em;
}
</style>
