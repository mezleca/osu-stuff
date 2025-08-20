import { writable } from "svelte/store";

export const is_maximized = writable(false);
export const active_tab = writable("");

// for collections / beatmmaps filter system
export const DEFAULT_SORT_OPTIONS = ["artist", "title", "duration"];
export const DEFAULT_STATUS_TYPES = ["graveyard", "pending", "wip", "ranked", "qualified", "loved"];
export const ALL_BEATMAPS_KEY = "@stuff:__all_beatmaps__";
export const ALL_STATUS_KEY = "@stuff:__all_status__";

const SPECIAL_KEYS = new Map([
    [ALL_BEATMAPS_KEY, "all beatmaps"],
    [ALL_STATUS_KEY, "all"]
]);

export const is_special_key = (key) => {
    return SPECIAL_KEYS.has(key);
};

// for special keys
export const convert_special_key = (key) => {
    return SPECIAL_KEYS.has(key) ? SPECIAL_KEYS.get(key) : key;
};
