import { get, writable } from "svelte/store";
import { access_token } from "./config";
import { show_notification } from "./notifications";

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

class DiscoverManager {
    constructor() {
        this.query = writable("");
        this.data = writable(DEFAULT_DATA_VALUES);
        this.beatmaps = writable([]);
    }

    async search() {
        const query = get(this.query);
        const token = get(access_token);

        if (query == "") {
            console.log("query is null");
            return;
        }

        if (token == "") {
            show_notification({ type: "error", text: "failed to search. reason: invalid access token" });
            return;
        }

        const normalized_data = [];

        for (const [key, values] of Object.entries(get(this.data))) {
            const filter_data = filter_map.get(key);
            const new_key = filter_data.code;
            const new_values = [];

            // convert shit like "categories" to make the shitty api do its thing
            for (const value of values) {
                if (!Array.isArray(filter_data.data)) {
                    continue;
                }
                new_values.push(filter_data.data[value]);
            }

            normalized_data[new_key] = new_values.length == 0 ? [values] : new_values;
        }

        // @TODO: values are invalid
        console.log(normalized_data);
        return;

        const result = await window.fetch({
            url: BASE_URL,
            headers: {
                Authorization: "Bearer " + token
            },
            form_data: get(data)
        });

        if (result.status != 200) {
            console.log("[discover] failed to fetch beatmaps", result);
            return;
        }

        console.log(result);
    }

    update(type, value) {
        if (!filter_map.has(type)) {
            console.log("[discover] type not found:", type);
            return;
        }

        const filter = filter_map.get(type);

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
        this.query.set(value);
    }
}

export const discover = new DiscoverManager();
