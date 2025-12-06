import { writable } from "svelte/store";

export const is_typing = writable(false);
export const is_maximized = writable(false);
export const active_tab = writable("index");

// for collections / beatmmaps filter system
export const DEFAULT_SORT_OPTIONS = ["artist", "title", "duration"];
export const DEFAULT_SELECTED_MAP = Object.freeze({ index: -1, md5: null });
export const DEFAULT_STATUS_TYPES = ["graveyard", "pending", "wip", "ranked", "qualified", "loved"];
export const ALL_BEATMAPS_KEY = "@stuff:__all_beatmaps__";
export const ALL_STATUS_KEY = "@stuff:__all_status__";

const SPECIAL_KEYS = new Map([
    [ALL_BEATMAPS_KEY, "all beatmaps"],
    [ALL_STATUS_KEY, "all"]
]);

export const is_special_key = (key: string) => {
    return SPECIAL_KEYS.has(key);
};

// for special keys
export const convert_special_key = (key: string) => {
    return SPECIAL_KEYS.has(key) ? SPECIAL_KEYS.get(key) : key;
};

export const validate_url = (url: string, target: string = "") => {
    try {
        const parsed = new URL(url);

        // needs a hostname
        if (!parsed.hostname || parsed.hostname.length == 0) {
            return false;
        }

        // check if target matches
        if (target != "" && parsed.hostname != target) {
            return false;
        }

        return true;
    } catch (e) {
        // invalid url
        return false;
    }
};

export const FILTER_TYPES = [
    ...DEFAULT_SORT_OPTIONS.map((b) => {
        return { label: b, value: b };
    }),
    { label: "length", value: "length" }
];

export const STATUS_TYPES = [
    { label: "all status", value: ALL_STATUS_KEY },
    ...DEFAULT_STATUS_TYPES.map((b) => {
        return { label: b, value: b };
    })
];
