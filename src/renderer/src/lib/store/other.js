import { writable } from "svelte/store";

export const is_maximized = writable(false);
export const active_tab = writable("");

// for collections / beatmmaps filter system
export const DEFAULT_SORT_OPTIONS = ["artist", "title", "duration"];
export const DEFAULT_STATUS_TYPES = ["graveyard", "pending", "ranked", "qualified", "loved"];
export const ALL_BEATMAPS_KEY = "@stuff:__all_beatmaps__";

const SPECIAL_KEYS = new Map([[ALL_BEATMAPS_KEY, "all beatmaps"]]);

// for special keys
export const convert_keys = (key) => {
	return SPECIAL_KEYS.has(key) ? SPECIAL_KEYS.get(key) : key;
};
