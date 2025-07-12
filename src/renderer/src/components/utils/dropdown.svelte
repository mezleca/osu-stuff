<!-- Dropdown.svelte -->
<script>
	export let options = [];
	export let selected_value = "";
	export let placeholder = "select an option";

	let is_open = false;
	let dropdown_ref;

	const toggle_dropdown = () => {
		is_open = !is_open;
	};

	const select_option = (option) => {
		selected_value = option.value || option;
		is_open = false;
	};

	const handle_click_outside = (event) => {
		if (dropdown_ref && !dropdown_ref.contains(event.target)) {
			is_open = false;
		}
	};

	const handle_keydown = (event) => {
		if (event.key == "Escape") {
			is_open = false;
		}
	};

	$: display_text = selected_value || placeholder;
</script>

<svelte:window on:click={handle_click_outside} on:keydown={handle_keydown} />

<div class="dropdown_container" bind:this={dropdown_ref}>
	<button class="dropdown_trigger" class:active={is_open} on:click={toggle_dropdown} type="button">
		<span class="dropdown_text">{display_text}</span>
		<div class="dropdown_arrow" class:active={is_open}></div>
	</button>
	{#if is_open}
		<div class="dropdown_menu">
			{#each options as option}
				<button class="dropdown_item" on:click={() => select_option(option)} type="button">
					{option.label || option}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown_container {
		position: relative;
		display: inline-block;
		width: fit-content;
		flex: 1;
	}

	.dropdown_trigger {
		background: #1a1a1a;
		padding: 8px 12px;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.dropdown_trigger:hover {
		background: #252525;
		border-color: #444;
	}

	.dropdown_trigger.active {
		border-color: #555;
		background: #252525;
	}

	.dropdown_text {
		text-align: left;
		flex: 1;
	}

	.dropdown_arrow {
		width: 0;
		height: 0;
		border-left: 4px solid transparent;
		border-right: 4px solid transparent;
		border-top: 4px solid #888;
		transition: transform 0.2s ease;
		margin-left: 8px;
	}

	.dropdown_arrow.active {
		transform: rotate(180deg);
	}

	.dropdown_menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 4px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		overflow: hidden;
	}

	.dropdown_item {
		padding: 8px 12px;
		cursor: pointer;
		transition: background 0.1s ease;
		font-size: 14px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		width: 100%;
		text-align: left;
		border-bottom: 1px solid #2a2a2a;
	}

	.dropdown_item:last-child {
		border-bottom: none;
	}

	.dropdown_item:hover {
		background: #252525;
	}

	.dropdown_item:focus {
		outline: none;
		background: #252525;
	}
</style>
