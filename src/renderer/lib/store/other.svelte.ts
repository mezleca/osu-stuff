import { ALL_BEATMAPS_KEY, ALL_MODES_KEY, ALL_STATUS_KEY, GameMode, IBeatmapResult } from "@shared/types";
import { toStore } from "svelte/store";

interface ICoreState {
    window: { active_tab: string; maximized: boolean; reset(): void };
    search: { focused: boolean; typing: boolean; element: HTMLInputElement | null; reset(): void };
}

export const core_state: ICoreState = $state({
    window: {
        active_tab: "index",
        maximized: false,
        reset() {
            core_state.window.active_tab = "index";
            core_state.window.maximized = false;
        }
    },
    search: {
        focused: false,
        typing: false,
        element: null,
        reset() {
            core_state.search.focused = false;
            core_state.search.typing = false;
        }
    }
});

export const set_active_tab = (active_tab: string) => {
    core_state.window.active_tab = active_tab;
};

export const set_window_maximized = (maximized: boolean) => {
    core_state.window.maximized = maximized;
};

export const reset_window_state = () => {
    core_state.window.reset();
};

export const set_search_focused = (focused: boolean) => {
    core_state.search.focused = focused;
};

export const set_search_typing = (typing: boolean) => {
    core_state.search.typing = typing;
};

export const set_search_element = (element: HTMLInputElement | null) => {
    core_state.search.element = element;
};

export const reset_search_state = () => {
    core_state.search.reset();
};

export const blur_search_element = () => {
    core_state.search.element?.blur();
};

export const search_has_dom_focus = () => {
    if (!core_state.search.element) {
        return false;
    }

    return document.activeElement == core_state.search.element;
};

export const should_ignore_search_shortcuts = () => {
    if (search_has_dom_focus()) {
        return true;
    }

    return core_state.search.focused || core_state.search.typing;
};

export const search_state = toStore(() => core_state.search);

const DEFAULT_SORT_VALUES: (keyof IBeatmapResult)[] = ["artist", "title", "duration"];
const DEFAULT_STATUS_VALUES = ["graveyard", "pending", "wip", "ranked", "qualified", "loved"];
const DEFAULT_MODE_VALUES: GameMode[] = [GameMode.Osu, GameMode.Taiko, GameMode.Catch, GameMode.Mania];

export const SEARCH_DEBOUNCE_INTERVAL = 50;
export const DEFAULT_SELECTED_MAP = Object.freeze({ index: -1, md5: null });

const SPECIAL_KEYS = new Map([
    [ALL_BEATMAPS_KEY, "all beatmaps"],
    [ALL_STATUS_KEY, "all status"],
    [ALL_MODES_KEY, "all modes"]
]);

export const is_special_key = (key: string) => {
    return SPECIAL_KEYS.has(key);
};

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

export const FILTER_DATA = [
    ...DEFAULT_SORT_VALUES.map((b) => {
        return { label: b as string, value: b as string };
    }),
    { label: "length", value: "length" }
];

export const STATUS_DATA = [
    { label: "all status", value: ALL_STATUS_KEY },
    ...DEFAULT_STATUS_VALUES.map((s) => {
        return { label: s as string, value: s as string };
    })
];

export const MODES_DATA = [
    { label: "all modes", value: ALL_MODES_KEY },
    ...DEFAULT_MODE_VALUES.map((m) => {
        return { label: m as string, value: m as string };
    })
];
