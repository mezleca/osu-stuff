import { writable, get } from "svelte/store";
import { get_beatmap_data, get_by_unique_id } from "../utils/beatmaps";
import { collections } from "./collections";
import { show_notification } from "./notifications";
import { ALL_BEATMAPS_KEY, ALL_STATUS_KEY } from "./other";
import { config } from "./config";

const mode_code = {
    osu: 0,
    "osu!": 0,
    taiko: 1,
    ctb: 2,
    mania: 3
};

const beatmap_status = {
    all: -1,
    unknown: 0,
    unsubmitted: 1,
    graveyard: 2,
    wip: 2,
    pending: 2,
    unused: 3,
    ranked: 4,
    approved: 5,
    qualified: 6,
    loved: 7
};

const lazer_status = {
    LocallyModified: -4,
    None: -3,
    Graveyard: -2,
    WIP: -1,
    Pending: 0,
    Ranked: 1,
    Approved: 2,
    Qualified: 3,
    Loved: 4
};

export class BeatmapListBase {
    constructor(list_id) {
        this.list_id = list_id;
        this.last_options = null;
        this.index = writable(-1);
        this.items = writable([]);
        this.selected = writable(null);
        this.query = writable("");
        this.sort = writable("");
        this.current_key = null;
        this.invalid_selected = writable(false);
    }

    set_items(items, key, ignore_context = false) {
        this.items.set(items);

        // try to use the same context (to preserve selected beatmaps, etc...)
        if (!ignore_context && this.current_key && this.current_key != key) {
            this.handle_context_change(items);
        }

        this.current_key = key;
    }

    async handle_context_change() {
        throw new Error("handle_context_change is not implemented yet");
    }

    async find_item() {
        throw new Error("find_item is not implement yet");
    }

    select_item(item, index) {
        const old_selected = get(this.selected);

        if (old_selected && this.is_same_item(item, old_selected)) {
            this.selected.set(null);
            this.index.set(-1);
            return;
        }

        this.selected.set(item);
        this.index.set(index);
    }

    is_same_item(item1, item2) {
        throw new Error("is_same_item is not implemented yet");
    }

    is_selected(item) {
        const current = get(this.selected);

        if (!current) {
            return false;
        }

        return this.is_same_item(item, current);
    }

    get_selected() {
        return get(this.selected);
    }

    get_query = () => get(this.query);
    get_sort = () => get(this.sort);
    is_empty = () => get(this.items)?.length == 0;

    clear() {
        this.items.set([]);
        this.selected.set(null);
        this.index.set(-1);
    }

    update_query(value) {
        this.query.set(value);
    }
}

class BeatmapList extends BeatmapListBase {
    constructor(list_id) {
        super(list_id);
        this.beatmaps = this.items;
        this.sr_range = writable({ min: 0, max: 10 });
        this.status = writable("");
        this.show_invalid = writable(false);
        this.is_unique = false;
    }

    set_beatmaps(beatmaps, key, unique = false, ignore_context = false) {
        this.set_items(beatmaps, key, ignore_context);
        this.is_unique = unique;
    }

    // will be used to try getting the old selected beatmap on the beatmap list
    // (so you dont lost selected context on like "specific collection -> all beatmaps")
    async handle_context_change(new_beatmaps) {
        try {
            const current_selected = this.get_selected();

            if (!current_selected) {
                return;
            }

            // get new beatmap using (song_name + md5) or just the md5 if we dont want unique shit
            const beatmap = this.is_unique
                ? await this.find_by_unique_id(new_beatmaps, current_selected)
                : await this.find_item(new_beatmaps, current_selected.md5);

            if (beatmap) {
                // if we found a beatmap that matches, update it.
                this.selected.set(beatmap);
            } else {
                // this will be used on control (reset index if the context is invalid)
                this.invalid_selected.set(true);
            }
        } catch (error) {
            console.log(error);
            this.selected.set(null);
        }
    }

    update_range(data) {
        this.sr_range.set(data);
    }

    async get_beatmaps(name, extra_options = {}) {
        // get all beatmaps if no collection_name is provided
        const is_all_beatmaps = name == ALL_BEATMAPS_KEY;
        const beatmaps = is_all_beatmaps ? null : collections.get(name)?.maps;
        const options = { ...extra_options };

        // prevent bullshitting
        if (!name && !is_all_beatmaps) {
            return null;
        }

        if (!is_all_beatmaps && !beatmaps) {
            show_notification({ type: "error", text: "failed to get beatmaps from " + name });
            return null;
        }

        // to return all of the beatmaps
        if (is_all_beatmaps) {
            options.all = true;
            options.unique = true;
        }

        // add star range to extra filter options
        const min = this.get_min_sr();
        const max = this.get_max_sr();

        if (!isNaN(min) && !isNaN(max)) {
            options.sr = { min, max };
        }

        const query = this.get_query();
        const sort = this.get_sort();
        const status = this.get_status();

        // to show invalid beatmaps ()
        options.invalid = this.get_show_invalid();

        // add sort to extra filter options
        if (sort != "") {
            options.sort = sort;
        }

        // add status to extra filter options (ignore all key)
        if (status != "" && status != ALL_STATUS_KEY) {
            options.status = status;
        }

        const result = await window.osu.filter_beatmaps(beatmaps, query, options);

        if (!result) {
            show_notification({ type: "error", text: "failed to filter beatmaps" });
            return null;
        }

        this.last_options = { name: name, extra: options };
        return result;
    }

    async reload_beatmaps() {
        if (this.last_options == null) {
            return;
        }

        const result = await this.get_beatmaps(this.last_options.name, this.last_options.extra);

        // just set the beatmaps directly instead of updating is_set, etc...
        this.beatmaps.set(result);
    }

    async find_item(beatmaps, target_md5) {
        const hash = beatmaps.find((h) => h == target_md5);
        if (!hash) {
            return null;
        }
        return await get_beatmap_data(hash);
    }

    async find_by_unique_id(beatmaps, old_beatmap) {
        if (!old_beatmap.unique_id) {
            return null;
        }

        const unique_beatmaps = await get_by_unique_id(old_beatmap.unique_id);

        for (let i = 0; i < unique_beatmaps.length; i++) {
            const beatmap = unique_beatmaps[i];
            if (beatmap.md5 == old_beatmap.md5) {
                const hash = beatmaps.find((h) => h == beatmap.md5);
                if (hash) {
                    return await get_beatmap_data(hash);
                }
            }
        }

        return null;
    }

    is_same_item(beatmap1, beatmap2) {
        return this.is_unique ? beatmap1.unique_id == beatmap2.unique_id : beatmap1.md5 == beatmap2.md5;
    }

    async find(beatmaps, target_md5) {
        const hash = beatmaps.find((h) => h == target_md5);
        if (!hash) {
            return null;
        }
        return await get_beatmap_data(hash);
    }

    async find_by_unique_id(beatmaps, old_beatmap) {
        if (!old_beatmap.unique_id) {
            return null;
        }

        const unique_beatmaps = await get_by_unique_id(old_beatmap.unique_id);

        for (let i = 0; i < unique_beatmaps.length; i++) {
            const beatmap = unique_beatmaps[i];
            if (beatmap.md5 == old_beatmap.md5) {
                const hash = beatmaps.find((h) => h == beatmap.md5);
                if (hash) {
                    return await get_beatmap_data(hash);
                }
            }
        }

        return null;
    }

    select_beatmap(beatmap, index) {
        this.select_item(beatmap, index);
    }

    update_range(data) {
        this.sr_range.set(data);
    }

    get_min_sr() {
        const sr_data = get(this.sr_range);
        return sr_data?.min ? sr_data.min : 0;
    }

    get_max_sr() {
        const sr_data = get(this.sr_range);
        return sr_data?.max ? sr_data.max : 0;
    }

    get_show_invalid = () => get(this.show_invalid);
    get_status = () => get(this.status);
}

const managers = new Map();

/** @returns {BeatmapList} */
export const get_beatmap_list = (tab_id) => {
    if (!managers.has(tab_id)) {
        managers.set(tab_id, new BeatmapList(tab_id));
    }

    return managers.get(tab_id);
};

export const get_code_by_mode = (mode) => mode_code[mode] ?? -1;

export const get_beatmap_status_code = (status) => {
    if (!status) {
        return 0;
    }

    const lazer_mode = config.get("lazer_mode");

    if (lazer_mode) {
        const key = Object.keys(lazer_status).find((k) => k.toLowerCase() == status.toLowerCase());
        return lazer_status[key];
    }

    return beatmap_status[status];
};

export const discover_beatmaps_search = writable("");
export const collection_search = writable("");
export const osu_beatmaps_store = writable(new Map());

export const osu_beatmaps = {
    add: (hash, beatmap) => {
        osu_beatmaps_store.update((map) => {
            const new_map = new Map(map);
            new_map.set(hash, beatmap);
            return new_map;
        });
    },
    set: (data) => {
        osu_beatmaps_store.update(() => data);
    },
    has: (hash) => {
        let exists = false;
        osu_beatmaps_store.subscribe((map) => {
            exists = map.has(hash);
        })();
        return exists;
    },
    get: (hash) => {
        let value;
        osu_beatmaps_store.subscribe((map) => {
            value = map.get(hash);
        })();
        return value;
    },
    remove: (hash) => {
        osu_beatmaps_store.update((map) => {
            const new_map = new Map(map);
            new_map.delete(hash);
            return new_map;
        });
    },
    clear: () => {
        osu_beatmaps_store.set(new Map());
    },
    all: () => {
        console.log(get(osu_beatmaps_store));
        return Array.from(get(osu_beatmaps_store).values());
    }
};
