import { writable, get, type Writable } from "svelte/store";
import { show_notification } from "./notifications";
import { ALL_BEATMAPS_KEY, ALL_STATUS_KEY } from "@shared/types";
import type { BeatmapComponentState, BeatmapSetComponentState, ISelectedBeatmap } from "@shared/types";
import {
    BeatmapSetResult,
    GameMode,
    IBeatmapFilter,
    IBeatmapResult,
    IBeatmapSetFilter,
    ISearchResponse,
    ISearchSetResponse,
    StarRatingFilter
} from "@shared/types";
import { config } from "./config";
import { throttle } from "../utils/timings";
import { collections } from "./collections";

import LRU from "quick-lru";

const beatmap_state: LRU<string, Writable<BeatmapComponentState>> = new LRU({ maxSize: 128 });
const beatmapset_state: LRU<number, Writable<BeatmapSetComponentState>> = new LRU({ maxSize: 64 });
const beatmap_managers = new Map<string, BeatmapList>();
const beatmapset_managers = new Map<string, BeatmapSetList>();

export abstract class ListBase<T> {
    id: Writable<string> = writable("");
    name: Writable<string> = writable("");
    query: Writable<string> = writable("");
    status: Writable<string> = writable(ALL_STATUS_KEY);
    mode: Writable<GameMode> = writable(GameMode.All);
    difficulty_range: Writable<StarRatingFilter> = writable([0, 10]);
    should_update: Writable<boolean> = writable(false);
    total_missing: Writable<number> = writable(0);
    items: Writable<T[]> = writable([]);
    previous_buffer: Writable<ISelectedBeatmap[]> = writable([]);
    selected_buffer: Writable<ISelectedBeatmap[]> = writable([]);

    constructor() {
        this.update_id();
    }

    update_id(): void {
        this.id.set(crypto.randomUUID());
    }

    update_name(name: string): void {
        this.name.set(name);
    }

    clear_selected(): void {
        this.selected_buffer.set([]);
    }

    set_difficulty_range(data: StarRatingFilter): void {
        this.difficulty_range.set(data);
    }

    set_query(value: string): void {
        this.query.set(value);
    }

    set_status(value: string): void {
        this.status.set(value);
    }

    set_update(value: boolean): void {
        this.should_update.set(value);
    }

    get_items(): T[] {
        return get(this.items);
    }

    set_items(items: T[]): void {
        this.items.set(items);
        this.update_id();
    }

    select(beatmap: ISelectedBeatmap): void {
        this.selected_buffer.set([beatmap]);
    }

    multi_select(beatmaps: ISelectedBeatmap[], replace = false): void {
        if (replace) {
            this.selected_buffer.set(beatmaps);
        } else {
            this.selected_buffer.update((current) => [...current, ...beatmaps]);
        }
    }

    get_idx_from_items(id: string | number): number {
        return this.get_items().findIndex((b) => b === id);
    }

    abstract search(): Promise<any>;
    abstract load(): Promise<boolean>;
    abstract reload(): Promise<void>;

    check_missing = throttle(async () => {
        const count = await collections.get_total_missing();
        this.total_missing.set(count);
    }, 1000);

    abstract clear(): void;
}

export class BeatmapList extends ListBase<string> {
    // filter options
    target: Writable<string> = writable(ALL_BEATMAPS_KEY);
    sort: Writable<keyof IBeatmapResult> = writable("title");
    show_invalid: Writable<boolean> = writable(false);
    show_unique: Writable<boolean> = writable(false);
    has_duration: Writable<boolean> = writable(false);

    // cache
    last_filter: string = "";
    last_result: ISearchResponse | null = null;

    constructor() {
        super();
    }

    set_target(name: string): void {
        this.target.set(name);
        this.update_name(name);
    }

    // attempt to rebuild the selected buffer by searching for the same beatmap
    async handle_context_change(hashes: string[]): Promise<boolean> {
        try {
            const current_selected = get(this.selected_buffer)[0];

            if (!current_selected) {
                return false;
            }

            const is_unique = get(this.show_unique);

            if (is_unique) {
                const found = await this.find_by_unique_id_batch(hashes, current_selected.id as string);

                // if we found, re-create the buffer
                if (found) {
                    this.clear_selected();
                    this.select(found);
                    return true;
                }
            } else {
                const index = hashes.indexOf(current_selected.id as string);

                if (index !== -1) {
                    this.select({ ...current_selected, index });
                    return true;
                }
            }

            this.clear_selected();
            return false;
        } catch (error) {
            console.log("[beatmap_list] handle_context_change error:", error);
            this.clear_selected();
            return false;
        }
    }

    build_filter(): IBeatmapFilter {
        let status = get(this.status);

        // stable classifies "graveyard / WIP" as pending
        if (!config.get("lazer_mode") && ["graveyard", "wip"].includes(status)) {
            status = "pending";
        }

        return {
            query: get(this.query),
            sort: get(this.sort),
            difficulty_range: get(this.difficulty_range),
            status: status,
            mode: get(this.mode),
            unique: get(this.show_unique),
            has_duration: get(this.has_duration)
        };
    }

    async search(force: boolean = false) {
        const filter = this.build_filter();
        const target = get(this.target);
        const current_filter = JSON.stringify({ ...filter, target });

        if (!force && this.last_filter && this.last_filter == current_filter) {
            if (this.last_result) {
                return this.last_result;
            }
        }

        try {
            const result = await window.api.invoke("client:search_beatmaps", filter, target);

            this.last_filter = JSON.stringify({ ...filter, target });
            this.last_result = result;

            return result;
        } catch (error) {
            console.error("[beatmap_list] search error:", error);
            show_notification({ type: "error", text: "Failed to search beatmaps" });
            return null;
        } finally {
            this.set_update(false);
        }
    }

    async load() {
        const result = await this.search();

        if (!result) {
            return false;
        }

        const hashes = result.beatmaps.map((b) => b.md5);
        this.set_items(hashes);
        return true;
    }

    async reload() {
        this.last_filter = null;
        this.last_result = null;
        await this.load();
    }

    find_item(md5: string): ISelectedBeatmap | null {
        const hashes = get(this.items);
        const index = hashes.indexOf(md5);

        if (index == -1) {
            return null;
        }

        return { id: md5, index };
    }

    async find_by_unique_id_batch(hashes: string[], target_md5: string): Promise<ISelectedBeatmap | null> {
        const { beatmaps } = await window.api.invoke("client:fetch_beatmaps", hashes);

        if (!beatmaps || beatmaps.length == 0) {
            return null;
        }

        // find target beatmap to get its unique_id
        const target = beatmaps.find((b) => b.md5 == target_md5);

        if (!target || !target.unique_id) {
            return null;
        }

        // find first beatmap with same unique_id
        for (let i = 0; i < beatmaps.length; i++) {
            const beatmap = beatmaps[i];

            if (beatmap.unique_id == target.unique_id) {
                const index = hashes.indexOf(beatmap.md5);

                if (index != -1) {
                    return { id: beatmap.md5, index };
                }
            }
        }

        return null;
    }

    is_same_item(item1: ISelectedBeatmap, item2: ISelectedBeatmap) {
        return item1.id == item2.id;
    }

    clear() {
        this.clear_selected();

        this.previous_buffer.set([]);
        this.items.set([]);
        this.last_filter = null;
        this.last_result = null;
    }
}

export class BeatmapSetList extends ListBase<number> {
    // extra filter options
    sort: Writable<keyof BeatmapSetResult["metadata"]> = writable("artist");
    search_cache = new Map<number, { filtered_hashes: string[]; beatmapset: BeatmapSetResult | null }>();

    // cache
    last_filter?: IBeatmapSetFilter = null;
    last_result?: ISearchSetResponse = null;

    constructor() {
        super();
    }

    build_filter(): IBeatmapSetFilter {
        let status = get(this.status);
        let mode = get(this.mode);

        // stable classifies "graveyard / WIP" as pending
        if (!config.get("lazer_mode") && ["graveyard", "wip"].includes(status)) {
            status = "pending";
        }

        return {
            query: get(this.query),
            sort: get(this.sort),
            difficulty_range: get(this.difficulty_range),
            status: status,
            mode: mode
        };
    }

    async search(force: boolean = false) {
        const filter = this.build_filter();
        const filter_json = JSON.stringify(filter);

        if (!force && this.last_filter && JSON.stringify(this.last_filter) == filter_json) {
            if (this.last_result) {
                return this.last_result;
            }
        }

        try {
            const ids: number[] = [];
            const result = await window.api.invoke("client:search_beatmapsets", filter);

            this.search_cache.clear();

            for (const beatmapset of result?.beatmapsets ?? []) {
                this.search_cache.set(beatmapset.online_id, {
                    filtered_hashes: beatmapset.beatmaps ?? [],
                    beatmapset: null
                });
                ids.push(beatmapset.online_id);
            }

            this.last_filter = filter;
            this.last_result = result;

            return result;
        } catch (error) {
            console.error("[beatmapset_list] search error:", error);
            show_notification({ type: "error", text: "failed to search beatmapsets" });
            return null;
        } finally {
            this.set_update(false);
        }
    }

    async load() {
        const result = await this.search();

        if (!result) {
            return false;
        }

        return true;
    }

    async reload() {
        this.last_filter = null;
        this.last_result = null;
        this.search_cache.clear();
        await this.load();
    }

    async find_item(beatmapset_id: number): Promise<ISelectedBeatmap | null> {
        const ids = get(this.items);
        const index = ids.indexOf(beatmapset_id);

        if (index == -1) {
            return null;
        }

        return {
            id: beatmapset_id,
            index
        };
    }

    get_filtered_beatmaps(beatmapset_id: number): string[] {
        return this.search_cache.get(beatmapset_id)?.filtered_hashes ?? [];
    }

    get_beatmapset(beatmapset_id: number): BeatmapSetResult | null {
        return this.search_cache.get(beatmapset_id)?.beatmapset ?? null;
    }

    clear() {
        this.clear_selected();

        this.previous_buffer.set([]);
        this.items.set([]);
        this.last_filter = null;
        this.last_result = null;
        this.search_cache.clear();
    }
}

export const get_beatmap_state = (id: string) => {
    if (beatmap_state.has(id)) {
        return beatmap_state.get(id)!;
    }

    const state = writable<BeatmapComponentState>({
        beatmap: null,
        loading: false,
        loaded: false,
        background: ""
    });

    beatmap_state.set(id, state);
    return state;
};

export const get_beatmapset_state = (id: number) => {
    if (beatmapset_state.has(id)) {
        return beatmapset_state.get(id)!;
    }

    const state = writable<BeatmapSetComponentState>({
        beatmapset: null,
        beatmaps: [],
        failed_beatmaps: new Set(),
        loaded: false,
        loading: false,
        background: ""
    });

    beatmapset_state.set(id, state);
    return state;
};

export const reset_beatmap_lists = () => {
    const beatmap_lists = Array.from(beatmap_managers.values());

    for (const list of beatmap_lists) {
        list.clear();
    }

    const beatmapset_lists = Array.from(beatmapset_managers.values());

    for (const list of beatmapset_lists) {
        list.clear();
    }
};

const refresh_missing_badges = async (): Promise<void> => {
    const count = await collections.get_total_missing();

    for (const list of beatmap_managers.values()) {
        list.total_missing.set(count);
    }

    for (const list of beatmapset_managers.values()) {
        list.total_missing.set(count);
    }
};

export const refresh_missing_count = async (): Promise<void> => {
    await refresh_missing_badges();
};

export const update_beatmap_lists = () => {
    const beatmap_lists = Array.from(beatmap_managers.values());

    for (const list of beatmap_lists) {
        list.set_update(true);
    }

    const beatmapset_lists = Array.from(beatmapset_managers.values());

    for (const list of beatmapset_lists) {
        list.set_update(true);
    }
};

export const get_beatmap_list = (tab_id: string): BeatmapList => {
    if (!beatmap_managers.has(tab_id)) {
        beatmap_managers.set(tab_id, new BeatmapList());
    }

    return beatmap_managers.get(tab_id)!;
};

export const get_beatmapset_list = (tab_id: string): BeatmapSetList => {
    if (!beatmapset_managers.has(tab_id)) {
        beatmapset_managers.set(tab_id, new BeatmapSetList());
    }

    return beatmapset_managers.get(tab_id)!;
};
