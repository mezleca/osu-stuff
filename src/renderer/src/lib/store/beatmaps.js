import { writable, get } from "svelte/store";
import { get_beatmap_data } from "../utils/beatmaps";

class BeatmapList {
	constructor(list_id) {
		this.list_id = list_id;
		this.index = writable(-1);
		this.beatmaps = writable([]);
		this.selected = writable(null);
		this.current_key = null;
		this.is_unique = false;
	}

	set_beatmaps(beatmaps, key, unique = false) {
		this.beatmaps.set(beatmaps);

		// try to use the same context (to preserve selected beatmaps, etc...)
		if (this.current_key && this.current_key != key) {
			this.handle_context_change(beatmaps, unique);
		}

		this.current_key = key;
		this.is_unique = unique;
	}

	async handle_context_change(new_beatmaps, unique) {
		const current_selected = this.get_selected();

		if (!current_selected) {
			return;
		}

		try {
			let beatmap = null;

			if (!unique) {
				beatmap = await this.find_by_md5(new_beatmaps, current_selected.md5);
			} else {
				beatmap = await this.find_by_unique_id(new_beatmaps, current_selected);
			}

			if (beatmap) {
				this.selected.set(beatmap);
			} else {
				this.selected.set(null);
			}
		} catch (error) {
			console.log(error);
			this.selected.set(null);
		}
	}

	async find_by_md5(beatmaps, target_md5) {
		const hash = beatmaps.find((h) => h == target_md5);
		if (!hash) {
			return null;
		}
		return await get_beatmap_data(hash);
	}

	async find_by_unique_id(beatmaps, old_beatmap) {
		if (!old_beatmap.unique_id) {
			return null;
		}

		const unique_beatmaps = await get_by_unique_id(old_beatmap.unique_id);

		for (let i = 0; i < unique_beatmaps.length; i++) {
			const beatmap = unique_beatmaps[i];
			if (beatmap.md5 == old_beatmap.md5) {
				const hash = beatmaps.find((h) => h == beatmap.md5);
				if (hash) {
					return await get_beat(hash);
				}
			}
		}

		return null;
	}

	select_beatmap(beatmap, index) {
		const old_selected = get(this.selected);

		if (old_selected && beatmap?.md5 == old_selected.md5) {
			this.selected.set(null);
			this.index.set(-1);
			return;
		}

		this.selected.set(beatmap);
		this.index.set(index);
	}

	get_selected() {
		return get(this.selected);
	}

	is_selected(beatmap) {
		const current = get(this.selected);

		if (!current) {
			return false;
		}

		return this.is_unique ? current.unique_id == beatmap.unique_id : current.md5 == beatmap.md5;
	}

	clear() {
		this.beatmaps.set([]);
		this.selected.set(null);
	}
}

const managers = new Map();

export const get_beatmap_list = (tab_id) => {
	if (!managers.has(tab_id)) {
		managers.set(tab_id, new BeatmapList(tab_id));
	}

	return managers.get(tab_id);
};

export const discover_beatmaps_search = writable("");
export const collection_beatmaps_search = writable("");
export const collection_search = writable("");
export const osu_beatmaps_store = writable(new Map());

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
	},
	all: () => {
		let all_beatmaps = [];
		osu_beatmaps_store.subscribe((map) => {
			all_beatmaps = Array.from(map.values());
		})();
		return all_beatmaps;
	}
};
