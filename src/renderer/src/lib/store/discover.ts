import { get, writable } from "svelte/store";
import { show_notification } from "./notifications";
import { debounce } from "../utils/utils";
import { BeatmapSetList } from "./beatmaps";

import type { Writable } from "svelte/store";
import type { BeatmapSetResult, BeatmapsSearchParams } from "@shared/types";
import type { Beatmapset } from "osu-api-extended/dist/types/v2/search_all";

export const DISCOVER_CATEGORIES = ["converts", "featured artists", "follows", "recommend", "spotlights"];
export const DISCOVER_LANGUAGES = [
    "Any",
    "English",
    "Chinese",
    "French",
    "German",
    "Italian",
    "Japanese",
    "Korean",
    "Spanish",
    "Swedish",
    "Russian",
    "Polish",
    "Instrumental",
    "Unspecified",
    "Other"
];
export const DISCOVER_MODES = ["osu", "fruits", "mania", "taiko"];
export const DISCOVER_STATUSES = ["any", "ranked", "qualified", "loved", "favourites", "pending", "wip", "graveyard", "mine"];
export const DISCOVER_EXTRAS = ["storyboard", "video"];

const build_beatmapset = (beatmapset: Beatmapset, temp: boolean): BeatmapSetResult => {
    return {
        online_id: beatmapset.id,
        metadata: {
            title: beatmapset.title,
            artist: beatmapset.artist,
            creator: beatmapset.creator
        },
        beatmaps: [],
        temp: temp
    };
};

class DiscoverManager extends BeatmapSetList {
    data: Writable<BeatmapsSearchParams> = writable({
        type: "beatmaps",
        _nsfw: true
    });

    // query store for search input
    query: Writable<string> = writable("");

    // beatmapset cache
    beatmapsets_cache: Map<number, BeatmapSetResult> = new Map();

    // expose items as beatmapsets for clarity
    beatmapsets: Writable<number[]> = this.items;

    // state
    last_state: string = "";
    should_update: Writable<boolean> = writable(false);
    is_loading: Writable<boolean> = writable(false);
    reached_end: Writable<boolean> = writable(false);

    constructor(custom_id?: string) {
        super(custom_id || "discover");
    }

    get_beatmapset(id: number): BeatmapSetResult | null {
        return this.beatmapsets_cache.get(id) || null;
    }

    get_current_search_state(): string {
        const data = get(this.data);
        return JSON.stringify(data);
    }

    get_values(key: "languages" | "categories" | "genres" | "modes"): string[] {
        switch (key) {
            case "languages":
                return DISCOVER_LANGUAGES;
            case "categories":
                return DISCOVER_CATEGORIES;
            case "genres":
                return []; // todo: add genres
            case "modes":
                return DISCOVER_MODES;
            default:
                return [];
        }
    }

    update_query(q: string): void {
        this.query.set(q);
        this.data.update((data) => ({ ...data, q, cursor_string: "" }));
        this.reached_end.set(false);
        this.search();
    }

    async search(): Promise<any> {
        this.debounced_search();
    }

    debounced_search = debounce(async () => {
        // one at time baby
        if (get(this.is_loading)) {
            return;
        }

        const reached_end = get(this.reached_end);

        if (reached_end) {
            console.log("[discover] reached end of results");
            return;
        }

        this.is_loading.set(true);

        const current_state = this.get_current_search_state();

        // reset cursor/beatmaps if search parameters changed
        if (this.last_state != current_state) {
            this.data.update((data) => ({ ...data, cursor_string: "" }));
            this.items.set([]);
            this.last_state = current_state;
        }

        // fetch data from osu api
        const result = await window.api.invoke("web:search", get(this.data));

        if (result.error) {
            show_notification({ type: "error", text: "failed to search: " + result.error.message });
            this.reached_end.set(true);
            this.is_loading.set(false);
            return;
        }

        // check if we reached the end
        if (!result || result.cursor_string == "") {
            this.reached_end.set(true);
        } else {
            this.reached_end.set(false);
            // update cursor for next page
            this.data.update((data) => ({ ...data, cursor_string: result.cursor_string }));
        }

        // sync beatmap data
        const new_ids: number[] = [];
        const ids = result.beatmapsets.map((b) => b.id);
        const exists_array = await window.api.invoke("driver:has_beatmapsets", ids);

        for (let i = 0; i < result.beatmapsets.length; i++) {
            const beatmapset = result.beatmapsets[i];
            const exists = exists_array[i];
            const set_result = build_beatmapset(beatmapset, !exists);
            this.beatmapsets_cache.set(beatmapset.id, set_result);
            new_ids.push(beatmapset.id);
        }

        // append to existing list
        this.items.update((old) => [...old, ...new_ids]);
        this.is_loading.set(false);
    }, 500);

    update<T extends keyof BeatmapsSearchParams>(key: T, value: BeatmapsSearchParams[T]): void {
        this.data.update((data) => ({ ...data, [key]: value, cursor_string: "" }));
        this.reached_end.set(false);
        this.search();
    }

    can_load_more(): boolean {
        return !get(this.is_loading) && !get(this.reached_end);
    }
}

export const discover = new DiscoverManager("discover");
