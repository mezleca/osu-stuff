import { writable } from "svelte/store";

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
		const config = await window.config.get();
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
			window.config.update({ [key]: value });
			update((config) => ({ ...config, [key]: value }));
		},
		get: (key) => {
			let current_config;
			subscribe((config) => (current_config = config))();
			// @ts-ignore
			return current_config[key] ?? null;
		}
	};
};

// token used for osu! api
export const access_token = writable("");

// global config
export const config = create_persistent_config();
