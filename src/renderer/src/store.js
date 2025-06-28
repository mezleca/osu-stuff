import { derived, writable } from "svelte/store";
import { indexed } from "./lib/indexed";

const default_config_fields = {
	osu_id: "",
	osu_secret: "",
	stable_path: "",
	stable_songs_path: "",
	lazer_path: "",
	lazer: false,
	local: false
};

const create_persistent_config = () => {
	const { subscribe, set: write_set, update } = writable({});

	// load saved config
	const load = async () => {
		const config = await indexed.all("config");
		const config_obj = { ...default_config_fields };

		for (const [k, v] of Object.entries(config)) {
			config_obj[k] = v;
		}

		write_set(config_obj);
	};

	load();

	return {
		subscribe,
		set: async (key, value) => {
			indexed.save("config", key, value);
			update((config) => ({ ...config, [key]: value }));
		},
		delete: async (key) => {
			await indexed.delete("config", key);
			update((config) => {
				// @ts-ignore
				const { [key]: removed, ...rest } = config;
				return rest;
			});
		},
		get: (key) => {
			let current_config;
			subscribe((config) => (current_config = config))();
			// @ts-ignore
			return current_config[key];
		}
	};
};

// window related stuff
export const is_maximized = writable(false);

// tab related stuff
export const active_tab = writable("");

// global shit
export const discover_beatmaps_search = writable("");
export const collection_beatmaps_search = writable("");
export const collection_search = writable("");

// collecions / discover audio object
export const audio_data = writable({});

// radio shit
export const radio_data = writable({});

// token used for osu! api
export const access_token = writable("");

// global config
export const config = create_persistent_config();

// mhm collections
export const collections_store = writable([]);
export const selected_collection_name = writable(null);

// beamtps
export const osu_beatmaps_store = writable(new Map());

// notifications
export const notifications_store = writable([]);

export const show_notification = (data) => {
	const defaults = {
		id: crypto.randomUUID(),
		type: "info",
		timeout: 999
	};

	const notification = { ...defaults, ...data };

	// add to the store
	notifications_store.update((all) => [notification, ...all]);

	// remove after the timeout
	setTimeout(() => remove_notification(notification.id), notification.timeout);
};

export const remove_notification = (id) => {
	notifications_store.update((all) => all.filter((n) => n.id != id));
};

export const selected_collection = derived([collections_store, selected_collection_name], ([$collections, $selected_name]) => {
	if (!$selected_name) return null;
	return $collections.find((c) => c.name == $selected_name) || null;
});

export const collection_beatmaps = derived(selected_collection, ($selected) => {
	if (!$selected?.maps) return [];
	return $selected.maps;
});

export const osu_beatmaps = {
	add: (hash, beatmap) => {
		osu_beatmaps_store.update((map) => {
			const new_map = new Map(map);
			new_map.set(hash, beatmap);
			return new_map;
		});
	},
	set: (data) => {
		osu_beatmaps_store.update(() => data);
	},
	get: (hash) => {
		let value;
		osu_beatmaps_store.subscribe((map) => {
			value = map.get(hash);
		})();
		return value;
	},
	remove: (hash) => {
		osu_beatmaps_store.update((map) => {
			const new_map = new Map(map);
			new_map.delete(hash);
			return new_map;
		});
	},
	clear: () => {
		osu_beatmaps_store.set(new Map());
	}
};

export const collections = {
	add: (collection) => {
		collections_store.update((old) => [...old, collection]);
	},
	set: (data) => {
		collections_store.update(() => data);
	},
	get: (name) => {
		let result = null;
		collections_store.subscribe((collections) => {
			result = collections.find((c) => c.name == name) || null;
		})();
		return result;
	},
	remove_beatmap: (name, md5) => {
		collections_store.update((collections) => {
			return collections.map((collection) => {
				if (collection.name != name) {
					return collection;
				}

				const maps = collection.maps;
				const index = maps.indexOf(md5);

				if (index != -1) {
					maps.splice(index, 1);
				}

				return { ...collection, maps };
			});
		});
	},
	remove: (name) => {
		collections_store.update((old) => old.filter((c) => c?.name != name));
		selected_collection_name.update((current) => (current == name ? null : current));
	},
	update: (name, data) => {
		collections_store.update((old) => old.map((c) => (c.name == name ? { ...c, ...data } : c)));
	},
	clear: () => {
		collections_store.set([]);
		selected_collection_name.set(null);
	},
	select: (name) => selected_collection_name.set(name),
	all: collections_store
};
