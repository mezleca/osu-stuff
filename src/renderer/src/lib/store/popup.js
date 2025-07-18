import { get, writable } from "svelte/store";

const DEFAULT_OPTIONS = {
	id: "",
	class: "",
	style: "",
	parent: "",
	text: "",
	label: "",
	value: "",
	data: []
};

export class PopupAddon {
	constructor() {
		this.elements = [];
		this.callback = null;
		this.element_stores = new Map();
	}

	add(id, type, options = {}) {
		const merged_options = { ...DEFAULT_OPTIONS, ...options };

		// validation
		if (!merged_options.text && type != "container") {
			console.log(`missing text for ${type}`);
			return this;
		}

		// validation
		if (type == "input" && !merged_options.label) {
			console.log("input requires label");
			return this;
		}

		const element = {
			id,
			type,
			options: merged_options
		};

		this.elements.push(element);
		this.element_stores.set(element.id, writable(merged_options.value));
		return this;
	}

	remove(element_id) {
		const index = this.elements.findIndex((el) => el.id == element_id);
		if (index != -1) {
			this.elements.splice(index, 1);
			this.element_stores.delete(element_id);
		}
		return this;
	}

	set_callback(callback) {
		this.callback = callback;
		return this;
	}

	clear_values() {
		for (let i = 0; i < this.elements.length; i++) {
			const element = this.elements[i];
			const store = this.element_stores.get(element.id);

			// @TODO: this assume the store is an string based value
			// if we implement a dropdown with multiple values this will prob cause a error
			store.set("");
		}
	}

	get_values() {
		const values = {};

		for (let i = 0; i < this.elements.length; i++) {
			const element = this.elements[i];
			const store = this.element_stores.get(element.id);

			if (store) {
				const result = get(store);
				values[element.id] = result;
			}
		}

		// clean store values
		this.clear_values();

		return values;
	}
}

class PopupManager {
	constructor() {
		this.popups = writable(new Map());
		this.active_popup = writable(null);
	}

	add_popup(key, addon) {
		this.popups.update((popups) => {
			popups.set(key, addon);
			return popups;
		});
	}

	show_popup(key) {
		this.popups.subscribe((popups) => {
			const popup = popups.get(key);
			if (popup) {
				this.active_popup.set({ key, popup });
			}
		})();
	}

	hide_popup() {
		const data = get(this.active_popup);
		if (data?.popup) {
			console.log("cleaning values");
			data.popup.clear_values();
		}
		this.active_popup.set(null);
	}

	get_active_popup() {
		return this.active_popup;
	}
}

const managers = new Map();

/** @returns {PopupManager()}  */
export const get_popup_manager = (key) => {
	if (!managers.has(key)) {
		managers.set(key, new PopupManager());
	}
	return managers.get(key);
};

export const add_new_popup = (key, addon, manager_key = "default") => {
	const manager = get_popup_manager(manager_key);
	manager.add_popup(key, addon);
};

export const show_popup = (key, manager_key = "default") => {
	const manager = get_popup_manager(manager_key);
	manager.show_popup(key);
};

export const hide_popup = (manager_key = "default") => {
	const manager = get_popup_manager(manager_key);
	manager.hide_popup();
};
