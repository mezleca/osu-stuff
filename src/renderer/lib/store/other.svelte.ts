import { ALL_BEATMAPS_KEY, ALL_MODES_KEY, ALL_STATUS_KEY, GameMode, IBeatmapResult } from "@shared/types";

interface ICoreState {
    window: { active_tab: string; maximized: boolean; reset(): void };
    export: { is_exporting: boolean };
    osu_web: { authenticated: boolean; fetching_token: boolean; token: string | null };
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
    export: {
        is_exporting: false
    },
    osu_web: {
        authenticated: false,
        fetching_token: false,
        token: null
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

const DEFAULT_SORT_VALUES: (keyof IBeatmapResult)[] = ["artist", "title", "duration"];
const DEFAULT_STATUS_VALUES = ["graveyard", "pending", "wip", "ranked", "qualified", "loved"];
const DEFAULT_MODE_VALUES: GameMode[] = [GameMode.Osu, GameMode.Taiko, GameMode.Catch, GameMode.Mania];

export const SEARCH_DEBOUNCE_INTERVAL = 50;

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
