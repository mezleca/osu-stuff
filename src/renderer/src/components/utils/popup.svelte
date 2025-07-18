<script>
	import { onMount } from "svelte";
	import { get_popup_manager, hide_popup } from "../../lib/store/popup";

	// components
	import Dropdown from "./dropdown.svelte";

	// props
	export let key = "default";

	let popup_manager;
	let active_popup = null;
	let container = null;
	let element_values = {};

	$: active = active_popup != null;

	// sync on update
	$: if (active_popup?.popup) {
		active_popup.popup.elements.forEach((element) => {
			const store = active_popup.popup.element_stores.get(element.id);
			if (store) {
				store.subscribe((value) => {
					element_values[element.id] = value;
				});
			}
		});
	}

	const update_store = (element_id, value) => {
		if (active_popup?.popup) {
			const store = active_popup.popup.element_stores.get(element_id);
			if (store) {
				store.set(value);
			}
		}
	};

	onMount(() => {
		popup_manager = get_popup_manager(key);

		const unsubscribe = popup_manager.get_active_popup().subscribe((popup) => {
			active_popup = popup;
		});

		return unsubscribe;
	});

	const handle_submit = () => {
		if (active_popup?.popup) {
			const values = active_popup.popup.get_values();
			if (active_popup.popup.callback) {
				active_popup.popup.callback(values);
			}
			hide_popup(key);
		}
	};

	const handle_cancel = () => {
		hide_popup(key);
	};

	const remove_focus = (event) => {
		if (event.target != container) return;
		handle_cancel();
	};

	const get_children = (parent_id) => {
		if (!active_popup?.popup) return [];
		return active_popup.popup.elements.filter((el) => el.options.parent == parent_id);
	};

	const get_root_elements = () => {
		if (!active_popup?.popup) return [];
		return active_popup.popup.elements.filter((el) => !el.options.parent);
	};

	const render_element = (element, is_child = false) => {
		return { element, is_child, children: get_children(element.options.id || element.id) };
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={container} class="popup-container" onclick={remove_focus} class:show={active}>
	{#if active_popup}
		<div class="popup-content">
			{#each get_root_elements() as element}
				{@const element_data = render_element(element)}
				{#if element.type == "checkbox"}
					<div class="field-group">
						<div class="checkbox-wrapper">
							<div class="checkbox">
								<input
									type="checkbox"
									id={element.id}
									bind:checked={element_values[element.id]}
									onchange={(e) => update_store(element.id, e.target.checked)}
									style={element.options.style}
								/>
								<div class="checkbox-custom"></div>
							</div>
							<label for={element.id} class="checkbox-text">{element.options.text}</label>
						</div>
					</div>
				{:else if element.type == "input"}
					<div class="field-group">
						<label for={element.id} class="field-label">{element.options.label}</label>
						<input
							class="text-input"
							type="text"
							id={element.id}
							placeholder={element.options.text}
							bind:value={element_values[element.id]}
							oninput={(e) => update_store(element.id, e.target.value)}
							style={element.options.style}
						/>
					</div>
				{:else if element.type == "dropdown"}
					<div class="field-group" style="display: flex;">
						<Dropdown
							options={element.options.data}
							selected_value={element_values[element.id]}
							placeholder={element.options.text}
							on_update={(value) => update_store(element.id, value)}
						/>
					</div>
				{:else if element.type == "container"}
					<div class="field-group">
						<div class={`container ${element.options.class || ""}`} id={element.options.id || element.id} style={element.options.style}>
							{#if element.options.text}
								<div class="container-title">{element.options.text}</div>
							{/if}
							{#each element_data.children as child}
								{#if child.type == "checkbox"}
									<div class="field-group">
										<div class="checkbox-wrapper">
											<div class="checkbox">
												<input
													type="checkbox"
													id={child.id}
													bind:checked={element_values[child.id]}
													onchange={(e) => update_store(child.id, e.target.checked)}
													style={child.options.style}
												/>
												<div class="checkbox-custom"></div>
											</div>
											<label for={child.id} class="checkbox-text">{child.options.text}</label>
										</div>
									</div>
								{:else if child.type == "input"}
									<div class="field-group">
										<label for={child.id} class="field-label">{child.options.label}</label>
										<input
											class="text-input"
											type="text"
											id={child.id}
											placeholder={child.options.text}
											bind:value={element_values[child.id]}
											oninput={(e) => update_store(child.id, e.target.value)}
											style={child.options.style}
										/>
									</div>
								{:else if child.type == "dropdown"}
									<div class="field-group">
										<Dropdown
											options={child.options.data}
											selected_value={element_values[child.id]}
											placeholder={child.options.text}
											on_update={(value) => update_store(child.id, value)}
										/>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/each}
			<div class="popup-actions">
				<button class="popup-cancel" onclick={handle_cancel}>cancel</button>
				<button class="popup-submit" onclick={handle_submit}>submit</button>
			</div>
		</div>
	{/if}
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
		min-width: 300px;
		max-width: 500px;
	}

	.container {
		border: 1px solid #333;
		padding: 15px;
		border-radius: 4px;
		background: #1a1a1a;
	}

	.container-title {
		font-weight: 500;
		margin-bottom: 10px;
		color: var(--text-primary);
	}

	.popup-actions {
		display: flex;
		gap: 10px;
		justify-content: center;
		margin-top: 20px;
		padding-top: 15px;
		border-top: 1px solid #333;
	}

	.popup-cancel,
	.popup-submit {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: background 0.15s ease;
	}

	.popup-cancel {
		background: #333;
		color: var(--text-secondary);
	}

	.popup-submit {
		background: var(--accent-color);
		color: white;
	}

	.popup-cancel:hover {
		background: #404040;
	}

	.popup-submit:hover {
		background: var(--accent-color2);
	}
</style>
