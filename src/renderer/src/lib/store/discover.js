import { get, writable } from "svelte/store";
import { access_token } from "./config";
import { show_notification } from "./notifications";
import { BeatmapListBase } from "./beatmaps";
import { debounce } from "../utils/utils";

// l
const discover_languages = {
    unspecified: 1,
    english: 2,
    chinese: 4,
    french: 7,
    german: 8,
    italian: 11,
    japanese: 13,
    korean: 6,
    spanish: 10,
    swedish: 9,
    russian: 12,
    polish: 13,
    instrumental: 5
};

// m
const discover_modes = {
    "osu!": 0,
    "osu!taiko": 1,
    "osu!catch": 2,
    "osu!mania": 3
};

// s
const discover_categories = ["any", "ranked", "qualified", "loved", "favourites", "pending", "wip", "graveyard", "mine"];

// g
const discover_genres = {
    unspecified: 1,
    "video game": 2,
    anime: 3,
    rock: 4,
    pop: 5,
    other: 6,
    novelty: 7,
    "hip hop": 9,
    eletronic: 10,
    metal: 11,
    classical: 12,
    folk: 13,
    jazz: 14
};

const filter_map = new Map([
    ["languages", { code: "l", data: discover_languages }],
    ["modes", { code: "m", data: discover_modes }],
    ["categories", { code: "s", data: discover_categories }],
    ["genres", { code: "g", data: discover_genres }]
]);

const BASE_URL = "https://osu.ppy.sh/api/v2/beatmapsets/search";
const DEFAULT_DATA_VALUES = { languages: [], modes: [], categories: [], genres: [] };

class DiscoverManager extends BeatmapListBase {
    constructor(list_id) {
        super(list_id);
        this.beatmaps = this.items;
        this.cursor = writable("");
        this.last_query = writable("");
        this.data = writable(DEFAULT_DATA_VALUES);
        this.should_update = writable(false);
        this.is_loading = writable(false);
        this.has_reached_end = writable(false);

        // track last search state to detect changes
        this.last_search_state = "";
    }

    set_beatmapsets(beatmapsets, key, ignore_context = false) {
        this.set_items(beatmapsets, key, ignore_context);
    }

    async handle_context_change() {
        // theres no reason to enable beatmap selection here so lets leave it empty
    }

    select_beatmap() {
        // prevents beatmaps component error
    }

    async find_item(beatmapsets, target_id) {
        return beatmapsets.find((set) => set.id == target_id) || null;
    }

    is_same_item(beatmapset1, beatmapset2) {
        return beatmapset1.id == beatmapset2.id;
    }

    async get_from_local_by_id(id) {
        const result = await window.osu.get_beatmap_by_id(id);
        return result;
    }

    select_beatmapset(beatmapset, index) {
        this.select_item(beatmapset, index);
    }

    bake_url(normalized_data) {
        const query = get(this.query);
        const cursor = get(this.cursor);
        const url = new URL(BASE_URL);

        // add query paramter if exists
        if (query && query.trim() != "") {
            url.searchParams.set("q", query);
        }

        // cursor = info about last beatmap of next batch? idk too lazy to read the docs
        if (cursor != "") {
            url.searchParams.set("cursor_string", cursor);
        }

        // use normalized data to bake the url
        for (const [key, value] of Object.entries(normalized_data)) {
            if (value) {
                if (Array.isArray(value)) {
                    // multiple values should be tied with a "."
                    if (value.length > 0) {
                        url.searchParams.set(key, value.join("."));
                    }
                } else {
                    url.searchParams.set(key, value.toString());
                }
            }
        }

        return url.toString();
    }

    // generate unique state string to compare search parameters
    get_current_search_state() {
        const query = get(this.query);
        const data = get(this.data);
        return JSON.stringify({ query, data });
    }

    search = debounce(async () => {
        // only one at time baby
        if (get(this.is_loading)) {
            return;
        }

        const token = get(access_token);

        if (token == "") {
            show_notification({ type: "error", text: "failed to search. reason: invalid access token" });
            return;
        }

        // dont make more request if we reached the end
        if (get(this.has_reached_end)) {
            console.log("[discover] reached end of results");
            return;
        }

        this.is_loading.set(true);

        const current_state = this.get_current_search_state();

        // reset cursor/beatmaps if search parameters changed
        if (this.last_search_state != current_state) {
            this.cursor.set("");
            this.beatmaps.set([]);
            this.has_reached_end.set(false);
            this.last_search_state = current_state;
        }

        try {
            const normalized_data = this.normalize_filter_data(get(this.data));
            const baked_url = this.bake_url(normalized_data);

            const result = await window.fetch({
                url: baked_url,
                headers: {
                    Authorization: "Bearer " + token
                }
            });

            if (result.status != 200) {
                console.log("[discover] failed to fetch beatmaps", result);
                return;
            }

            const data = result.json();

            // check if we have any beatmaps left to search
            if (!data.beatmapsets || data.beatmapsets.length == 0) {
                this.has_reached_end.set(true);
                return;
            }

            // append download, local
            const updated_beatmapsets = await Promise.all(
                data.beatmapsets.map(async (set) => {
                    const local_beatmap = await this.get_from_local_by_id(set.id);
                    if (local_beatmap) {
                        set.downloaded = local_beatmap.downloaded;
                        set.local = local_beatmap.local;
                    }
                    return set;
                })
            );

            const current_cursor = get(this.cursor);

            // update beatmap list
            if (current_cursor == "") {
                this.beatmaps.set([...updated_beatmapsets]);
            } else {
                this.beatmaps.update((sets) => [...sets, ...updated_beatmapsets]);
            }

            // update cursor
            const new_cursor = data.cursor_string || "";
            this.cursor.set(new_cursor);

            // that means we reached the end ;-;
            if (new_cursor == "") {
                this.has_reached_end.set(true);
            }

            this.last_query.set(get(this.query));
        } catch (error) {
            console.error("[discover] search error:", error);
            show_notification({ type: "error", text: "failed to search beatmaps" });
        } finally {
            this.is_loading.set(false);
        }
    }, 500);

    normalize_filter_data(data) {
        const normalized_data = {};

        for (const [key, values] of Object.entries(data)) {
            // for some reason the osu! api use a single char for filter params..
            const filter_data = filter_map.get(key);

            if (!filter_data) {
                continue;
            }

            const new_key = filter_data.code;

            // return the expected filter value (ex: japanese -> 13)
            if (typeof values == "string") {
                // in this case, the value will be the same
                if (Array.isArray(filter_data.data)) {
                    normalized_data[new_key] = values;
                } else {
                    normalized_data[new_key] = filter_data.data[values];
                }
            } else if (Array.isArray(values) && values.length > 0) {
                // in this case, the value will be the same
                if (Array.isArray(filter_data.data)) {
                    normalized_data[new_key] = values;
                } else {
                    const mapped_values = values.map((value) => filter_data.data[value]).filter((val) => val != undefined);

                    if (mapped_values.length > 0) {
                        normalized_data[new_key] = mapped_values;
                    }
                }
            }
        }

        return normalized_data;
    }

    update(type, value) {
        if (!filter_map.has(type)) {
            console.log("[discover] type not found:", type);
            return;
        }

        const filter = filter_map.get(type);

        // surely this will not fuck if we're sellecting multiple shit
        if (!value) {
            this.data.update((obj) => ({ ...obj, [type]: [] }));
        } else {
            if (Array.isArray(filter.data)) {
                if (!filter.data.includes(value)) {
                    console.log("[discover] value doenst exist:", type, value);
                    return;
                }
                this.data.update((obj) => ({ ...obj, [type]: value }));
            } else {
                if (!filter.data[value]) {
                    console.log("[discover] value doenst exist:", type, value);
                    return;
                }
                this.data.update((obj) => ({ ...obj, [type]: [value] }));
            }
        }

        // force immediate reset and search trigger
        this.cursor.set("");
        this.beatmaps.set([]);
        this.has_reached_end.set(false);

        // trigger search immediately after filter change
        this.search();
    }

    get_values(type) {
        if (!filter_map.has(type)) {
            console.log("[discover] type not found:", type);
            return;
        }

        const filter = filter_map.get(type);

        if (Array.isArray(filter.data)) {
            return filter.data;
        } else {
            return Object.keys(filter.data);
        }
    }

    update_query(value) {
        if (get(this.query) == value) return;
        this.query.set(value);
        this.has_reached_end.set(false);
        this.search();
    }

    can_load_more() {
        return !get(this.is_loading) && !get(this.has_reached_end);
    }
}

export const discover = new DiscoverManager("discover");
