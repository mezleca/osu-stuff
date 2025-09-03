import { writable, get } from "svelte/store";
import { get_beatmap_data, get_by_unique_id } from "../utils/beatmaps";
import { collections } from "./collections";
import { show_notification } from "./notifications";
import { ALL_BEATMAPS_KEY, ALL_STATUS_KEY } from "./other";
import { config } from "./config";
import { debounce } from "../utils/utils";

export const mode_code = {
    osu: 0,
    "osu!": 0,
    taiko: 1,
    ctb: 2,
    mania: 3
};

export const beatmap_status = {
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

export const lazer_status = {
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

const managers = new Map();

export class BeatmapListBase {
    constructor(list_id) {
        this.list_id = writable(list_id || crypto.randomUUID());
        this.max_size = 0;
        this.last_options = null;
        this.last_received_index = 0; // index of the last request beatmap
        this.last_result = null; // last beatmap array or something
        this.hide_remove = writable(false); // hide remove beatmap option from context menu
        this.index = writable(-1); // index of selected?
        this.items = writable([]);
        this.selected = writable(null);
        this.query = writable("");
        this.sort = writable("");
        this.current_key = null;
        this.invalid_selected = writable(false);
    }

    get_items() {
        return get(this.items);
    }

    get_list_length() {
        return get(this.items).length;
    }

    set_items(items, key, ignore_context = false) {
        this.items.set(items);

        // try to use the same context (to preserve selected beatmaps, etc...)
        if (!ignore_context && this.current_key && this.current_key != key) {
            this.handle_context_change(items);
        }

        this.last_received_index = 0;
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
        } else {
            this.selected.set(item);
            this.index.set(index);
        }
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

    update_list_id(id) {
        this.list_id.set(id);
    }

    update_query(value) {
        this.query.set(value);
    }

    clear() {
        this.last_received_index = 0;
        this.items.set([]);
        this.selected.set(null);
        this.index.set(-1);
        this.last_options = null;
        this.last_result = null;
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
        this.temp_items = new Map();
        this.loading_queue = new Set();
    }

    set_beatmaps(count, key, unique = false, ignore_context = false) {
        // create virtual items based on count
        const beatmaps = [];
        this.loading_queue.clear();

        for (let i = 0; i < count; i++) {
            beatmaps[i] = { index: i, pending: true, collection_key: key };
        }

        this.set_items(beatmaps, key, ignore_context);
        this.is_unique = unique;
    }

    update_list_debounce = debounce(() => {
        for (const [index, data] of this.temp_items) {
            this.beatmaps.update((arr) => {
                arr[index] = { ...data, pending: false };
                this.temp_items.delete(index);
                return arr;
            });
        }
    }, 25);

    update_beatmap(index, data) {
        const updated_beatmaps = get(this.beatmaps);

        // ignore old updates
        if (updated_beatmaps[index]?.collection_key != this.current_key) {
            return;
        }

        // update pending beatmap
        this.temp_items.set(index, data);
        this.update_list_debounce();
    }

    // will be used to try getting the old selected beatmap on the beatmap list
    // (so you dont lost selected context on like "specific collection -> all beatmaps")
    async handle_context_change(new_beatmaps) {
        try {
            const current_selected = get(this.selected);

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

    async load_beatmap_at_index(index) {
        const request_key = `${this.current_key}-${index}`;

        if (this.loading_queue.has(request_key)) {
            return;
        }

        this.loading_queue.add(request_key);

        const beatmap_data = await get_beatmap_data({
            id: get(this.list_id),
            index: index,
            virtual: true
        });

        if (this.current_key == get(this.beatmaps)[index]?.collection_key) {
            this.update_beatmap(index, beatmap_data);
        }

        this.loading_queue.delete(request_key);
    }

    async get_beatmaps(name, extra_options = {}) {
        // get all beatmaps if no collection_name is provided
        const options = { ...extra_options };

        if (this.current_collection != name) {
            options.force_clear = true;
            this.current_collection = name;
        }

        // add star range to extra filter options
        const min = this.get_min_sr();
        const max = this.get_max_sr();

        if (min != null && max != null && !isNaN(min) && !isNaN(max) && Number(min) < Number(max)) {
            options.sr = { min, max };
        }

        const query = get(this.query);
        const sort = get(this.sort);
        const status = get(this.status);

        // to show invalid beatmaps ()
        options.invalid = get(this.show_invalid);

        // add sort to extra filter options
        if (sort != "") {
            options.sort = sort;
        }

        // add status to extra filter options (ignore all key)
        if (status != "" && status != ALL_STATUS_KEY) {
            options.status = status;
        }

        // add query to extra filter options
        if (query != undefined) {
            options.query = query;
        }

        // add list id
        options.id = get(this.list_id);

        const options_state = JSON.stringify({ name, extra: options });
        const last_state = JSON.stringify(this.last_options);

        // return old state if we have the same options, etc...
        if (options_state == last_state && this.last_result) {
            return this.last_result;
        }

        const result = await window.osu.update_beatmap_list(options);

        if (!result.found) {
            show_notification({ type: "error", text: "failed to filter beatmaps (list not found)" });
            return null;
        }

        // we dont want that
        if (options.force) {
            delete options.force;
        }

        this.last_options = { name: name, extra: options };
        this.last_result = result;
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
        const v = sr_data?.min;
        return v == undefined || v == null ? null : Number(v);
    }

    get_max_sr() {
        const sr_data = get(this.sr_range);
        const v = sr_data?.max;
        return v == undefined || v == null ? null : Number(v);
    }
}

class OsuBeatmaps {
    constructor() {
        this.beatmaps = writable(new Map());
    }

    add(key, beatmap) {
        this.beatmaps.update((map) => {
            const new_map = new Map(map);
            new_map.set(key, beatmap);
            return new_map;
        });
    }

    remove(key) {
        this.beatmaps.update((map) => {
            const new_map = new Map(map);
            new_map.delete(key);
            return new_map;
        });
    }

    get(key) {
        return get(this.beatmaps).get(key);
    }

    has(key) {
        return get(this.beatmaps).has(key);
    }

    all() {
        return get(this.beatmaps);
    }
}

export const reset_beatmap_lists = () => {
    const lists = Array.from(managers.values());

    for (const list of lists) {
        list.clear();
    }
};

/** @returns {BeatmapList} */
export const get_beatmap_list = (tab_id) => {
    if (!managers.has(tab_id)) {
        managers.set(tab_id, new BeatmapList(tab_id));
    }

    return managers.get(tab_id);
};

export const get_code_by_mode = (mode) => {
    return mode_code[mode] ?? -1;
};

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

export const osu_beatmaps = new OsuBeatmaps();
