import { writable } from "svelte/store";

export const is_maximized = writable(false);
export const active_tab = writable("");

// for collections / beatmmaps filter system
export const DEFAULT_SORT_OPTIONS = ["artist", "title", "duration"];
export const DEFAULT_STATUS_TYPES = ["graveyard", "pending", "ranked", "qualified", "loved"];
