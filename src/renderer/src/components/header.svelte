<script>
	import { active_tab } from "../store";
	import Line from "./icon/line.svelte";
	import Square from "./icon/square.svelte";
	import X from "./icon/x.svelte";

	// props
	export let active = false;

	const set_active_tab = (tab) => {
		// prob will only happen if are still on the loading screen
		if (!active) {
			return;
		}

		$active_tab = tab;
	};

	const tabs = ["collections", "browse", "discover", "radio", "config", "status"];
</script>

<div class="header">
	<div class="header-left">
		<button class="app-title" on:click={() => set_active_tab("")}>osu-stuff</button>
		<div class="tabs">
			{#each tabs as tab}
				<button class="tab" on:click={() => set_active_tab(tab)} class:active={$active_tab == tab}>
					{tab}
				</button>
			{/each}
		</div>
	</div>
	<div class="window-controls">
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button class="control-btn minimize" on:click={() => window.extra.minimize()}>
			<Line />
		</button>
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button class="control-btn maximize" on:click={() => window.extra.maximize()}>
			<Square />
		</button>
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button class="control-btn close" on:click={() => window.extra.close()}>
			<X />
		</button>
	</div>
</div>
