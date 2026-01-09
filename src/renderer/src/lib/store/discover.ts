import { get, writable } from "svelte/store";
import { show_notification } from "./notifications";
import { debounce } from "../utils/timings";
import { beatmap_cache, beatmapset_cache } from "../utils/beatmaps";
import { BeatmapSetList } from "./beatmaps";

import type { Writable } from "svelte/store";
import type { BeatmapSetResult, BeatmapsSearchParams, IBeatmapResult } from "@shared/types";
import type { Beatmapset, Beatmap } from "osu-api-extended/dist/types/v2/search_all";

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

interface IApiBeatmapSetMetadata {
    title: string;
    artist: string;
    creator: string;
    source: string;
    tags: string;
}

const build_beatmap = (beatmap: Beatmap, metadata: IApiBeatmapSetMetadata): IBeatmapResult => {
    return {
        md5: beatmap.checksum || "",
        online_id: beatmap.id,
        beatmapset_id: beatmap.beatmapset_id,
        title: metadata.title,
        artist: metadata.artist,
        creator: metadata.creator,
        difficulty: beatmap.version,
        source: metadata.source,
        tags: metadata.tags,
        star_rating: beatmap.difficulty_rating,
        bpm: beatmap.bpm,
        length: beatmap.hit_length,
        last_modified: Date.now().toString(),
        ar: beatmap.ar,
        cs: beatmap.cs,
        hp: beatmap.drain,
        od: beatmap.accuracy,
        status: beatmap.status,
        mode: beatmap.mode,
        temp: true,
        background: ""
    };
};

const build_beatmapset = (beatmapset: Beatmapset): BeatmapSetResult => {
    const metadata: IApiBeatmapSetMetadata = {
        title: beatmapset.title,
        artist: beatmapset.artist,
        creator: beatmapset.creator,
        tags: beatmapset.tags,
        source: beatmapset.source
    };

    const hashes: string[] = [];

    // get hashes / save to temp cache
    for (const beatmap of beatmapset.beatmaps) {
        hashes.push(beatmap.checksum);

        if (!beatmap_cache.has(beatmap.checksum)) {
            beatmap_cache.set(beatmap.checksum, build_beatmap(beatmap, metadata));
        }
    }

    return {
        online_id: beatmapset.id,
        metadata: {
            title: metadata.title,
            artist: metadata.artist,
            creator: metadata.creator
        },
        beatmaps: hashes,
        temp: true
    };
};

class DiscoverManager extends BeatmapSetList {
    data: Writable<BeatmapsSearchParams> = writable({
        type: "beatmaps",
        _nsfw: true,
        mode: "osu"
    });

    // beatmaps
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
        return beatmapset_cache.get(id);
    }

    get_current_search_state(): string {
        const data = get(this.data);
        const { cursor_string, ...rest } = data;
        return JSON.stringify(rest);
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
        const data = get(this.data);
        const has_items = get(this.items).length > 0;

        if (q == data.query && has_items) {
            return;
        }

        this.data.update((d) => ({ ...d, query: q, cursor_string: "" }));
        this.items.set([]);
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
        const set_exists = await window.api.invoke("driver:has_beatmapsets", ids);

        for (let i = 0; i < result.beatmapsets.length; i++) {
            const beatmapset = result.beatmapsets[i];
            const exists = set_exists[i];

            // if we dont have the beatmap, build and cache it
            if (!exists) {
                const set_result = build_beatmapset(beatmapset);
                beatmapset_cache.set(beatmapset.id, set_result);
            }

            new_ids.push(beatmapset.id);
        }

        // append to existing list
        this.items.update((old) => [...old, ...new_ids]);
        this.is_loading.set(false);
    }, 500);

    update<T extends keyof BeatmapsSearchParams>(key: T, value: BeatmapsSearchParams[T]): void {
        this.data.update((data) => ({ ...data, [key]: value, cursor_string: "" }));
        this.items.set([]);
        this.reached_end.set(false);
        this.search();
    }

    can_load_more(): boolean {
        return !get(this.is_loading) && !get(this.reached_end);
    }
}

export const discover = new DiscoverManager("discover");
