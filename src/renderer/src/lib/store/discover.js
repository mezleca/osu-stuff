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
        const token = get(access_token);

        if (token == "") {
            show_notification({ type: "error", text: "failed to search. reason: invalid access token" });
            return;
        }

        const current_state = this.get_current_search_state();

        // reset cursor/beatmaps if search parameters changed
        if (this.last_search_state != current_state) {
            this.cursor.set("");
            this.beatmaps.set([]);
            this.last_search_state = current_state;
        }

        const normalized_data = [];

        for (const [key, values] of Object.entries(get(this.data))) {
            // for some reason the osu! api use a single char for filter params...
            const filter_data = filter_map.get(key);
            const new_key = filter_data.code;

            // return the expected filter value (ex: japanese -> 13)
            if (typeof values == "string") {
                // in this case, the value will be the same
                if (Array.isArray(filter_data.data)) {
                    normalized_data[new_key] = values;
                } else {
                    normalized_data[new_key] = filter_data.data[values];
                }
            } else {
                for (const value of values) {
                    // in this case, the value will be the same
                    if (Array.isArray(filter_data.data)) {
                        normalized_data[new_key] = value;
                    } else {
                        normalized_data[new_key] = filter_data.data[value];
                    }
                }
            }
        }

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

        // only append if we are paginating, otherwise replace
        const current_cursor = get(this.cursor);

        if (current_cursor == "") {
            this.beatmaps.set([...data.beatmapsets]);
        } else {
            this.beatmaps.update((sets) => [...sets, ...data.beatmapsets]);
        }

        this.cursor.set(data.cursor_string || "");
        this.last_query.set(get(this.query));
        this.should_update.set(false);
    }, 250);

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
                if (filter.data[value] == undefined) {
                    console.log("[discover] value doenst exist:", type, value);
                    return;
                }
                this.data.update((obj) => ({ ...obj, [type]: [value] }));
            }
        }

        // force immediate reset and search trigger
        this.cursor.set("");
        this.beatmaps.set([]);
        this.should_update.set(true);

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
        this.search();
    }
}

export const discover = new DiscoverManager("discover");
