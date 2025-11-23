import { writable, get, type Writable } from "svelte/store";
import { show_notification } from "./notifications";
import { ALL_BEATMAPS_KEY } from "./other";
import type {
    BeatmapSetResult,
    IBeatmapFilter,
    IBeatmapResult,
    IBeatmapSetFilter,
    ISearchResponse,
    ISearchSetResponse,
    StarRatingFilter
} from "@shared/types";

const beatmap_managers = new Map<string, BeatmapList>();
const beatmapset_managers = new Map<string, BeatmapSetList>();

interface ISelectedBeatmap {
    md5: string;
    index: number;
}

export abstract class ListBase {
    key: string = crypto.randomUUID();
    list_id: Writable<string> = writable(this.key);
    query: Writable<string> = writable("");
    status: Writable<string> = writable("");
    difficulty_range: Writable<StarRatingFilter> = writable([0, 10]);
    show_remove: Writable<boolean> = writable(true);
    previous_buffer: Writable<ISelectedBeatmap[]> = writable([]);
    selected: Writable<ISelectedBeatmap | null> = writable(null);

    constructor(id: string) {
        this.list_id.set(id);
    }

    update_list_id(id: string): void {
        this.list_id.set(`${this.key}-${id}`);
    }

    clear_selected(): void {
        this.selected.set(null);
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

    abstract search(): Promise<any>;
    abstract load(): Promise<boolean>;
    abstract reload(): Promise<void>;
    abstract clear(): void;
}

export class BeatmapList extends ListBase {
    items: Writable<string[]> = writable([]);
    selected_buffer: Writable<string[]> = writable([]);

    // filter options
    target: Writable<string> = writable("");
    sort: Writable<keyof IBeatmapResult> = writable("title");
    show_invalid: Writable<boolean> = writable(false);
    show_unique: Writable<boolean> = writable(false);

    // cache
    last_filter: IBeatmapFilter | null = null;
    last_result: ISearchResponse | null = null;

    constructor(id: string) {
        super(id);
    }

    get_items(): string[] {
        return get(this.items);
    }

    get_list_length(): number {
        return get(this.items).length;
    }

    set_items(items: string[], query?: string, should_update_id = true): void {
        this.items.set(items);

        if (should_update_id && query) {
            this.update_list_id(query);
        }
    }

    select(md5: string, index: number): void {
        this.selected.set({ md5, index });
    }

    multi_select(hashes: string[], replace = false): void {
        if (replace) {
            this.selected_buffer.set(hashes);
        } else {
            this.selected_buffer.update((current) => [...current, ...hashes]);
        }
    }

    clear_multi_selected(): void {
        this.selected_buffer.set([]);
    }

    async handle_context_change(hashes: string[]) {
        try {
            const current_selected = get(this.selected);
            if (!current_selected) return false;

            const is_unique = get(this.show_unique);

            if (is_unique) {
                const found = await this.find_by_unique_id_batch(hashes, current_selected.md5);
                if (found) {
                    this.selected.set(found);
                    return true;
                }
            } else {
                const index = hashes.indexOf(current_selected.md5);
                if (index !== -1) {
                    this.selected.set({ md5: current_selected.md5, index });
                    return true;
                }
            }

            this.selected.set(null);
            return false;
        } catch (error) {
            console.log("[beatmap_list] handle_context_change error:", error);
            this.selected.set(null);
            return false;
        }
    }

    build_filter(): IBeatmapFilter {
        const target = get(this.target);

        return {
            query: get(this.query),
            sort: get(this.sort),
            difficulty_range: get(this.difficulty_range),
            status: get(this.status) || undefined,
            show_invalid: get(this.show_invalid),
            unique: get(this.show_unique),
            collection: target == ALL_BEATMAPS_KEY ? undefined : target
        };
    }

    async search() {
        const filter = this.build_filter();
        const filter_json = JSON.stringify(filter);

        if (this.last_filter && JSON.stringify(this.last_filter) == filter_json) {
            if (this.last_result) {
                return this.last_result;
            }
        }

        try {
            const result = await window.api.invoke("driver:search_beatmaps", filter);

            this.last_filter = filter;
            this.last_result = result;

            return result;
        } catch (error) {
            console.error("[beatmap_list] search error:", error);
            show_notification({ type: "error", text: "Failed to search beatmaps" });
            return null;
        }
    }

    async load() {
        const result = await this.search();

        if (!result) {
            return false;
        }

        const hashes = result.beatmaps.map((b) => b.md5);
        const key = JSON.stringify(this.build_filter());

        this.set_items(hashes, key);
        return true;
    }

    async reload() {
        this.last_filter = null;
        this.last_result = null;
        await this.load();
    }

    async find_item(md5: string): Promise<ISelectedBeatmap | null> {
        const hashes = get(this.items);
        const index = hashes.indexOf(md5);

        if (index == -1) {
            return null;
        }

        return { md5, index };
    }

    async find_by_unique_id_batch(hashes: string[], target_md5: string): Promise<ISelectedBeatmap | null> {
        const beatmaps = await window.api.invoke("driver:fetch_beatmaps", hashes);

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
                    return { md5: beatmap.md5, index };
                }
            }
        }

        return null;
    }

    is_same_item(item1: ISelectedBeatmap, item2: ISelectedBeatmap) {
        return item1.md5 == item2.md5;
    }

    clear() {
        this.items.set([]);
        this.selected.set(null);
        this.selected_buffer.set([]);
        this.last_filter = null;
        this.last_result = null;
    }
}

export class BeatmapSetList extends ListBase {
    items: Writable<number[]> = writable([]);
    selected_buffer: Writable<number[]> = writable([]);

    // extra filter options
    sort: Writable<keyof BeatmapSetResult["metadata"]> = writable("artist");

    // cache
    last_filter?: IBeatmapSetFilter = null;
    last_result?: ISearchSetResponse = null;

    constructor(id: string) {
        super(id);
    }

    // expansion state

    get_items(): number[] {
        return get(this.items);
    }

    get_list_length(): number {
        return get(this.items).length;
    }

    set_items(items: number[], query?: string, should_update_id = true): void {
        this.items.set(items);

        if (should_update_id && query) {
            this.update_list_id(query);
        }
    }

    select(beatmapset_id: number, index: number): void {
        this.selected.set({
            md5: String(beatmapset_id),
            index
        });
    }

    multi_select(ids: number[], replace = false): void {
        if (replace) {
            this.selected_buffer.set(ids);
        } else {
            this.selected_buffer.update((current) => [...current, ...ids]);
        }
    }

    clear_multi_selected(): void {
        this.selected_buffer.set([]);
    }

    build_filter(): IBeatmapSetFilter {
        return {
            query: get(this.query),
            sort: get(this.sort),
            status: get(this.status) || undefined,
            show_invalid: false
        };
    }

    async search() {
        const filter = this.build_filter();
        const filter_json = JSON.stringify(filter);

        if (this.last_filter && JSON.stringify(this.last_filter) == filter_json) {
            if (this.last_result) {
                return this.last_result;
            }
        }

        try {
            const result = await window.api.invoke("driver:search_beatmapsets", filter);

            this.last_filter = filter;
            this.last_result = result;

            return result;
        } catch (error) {
            console.error("[beatmapset_list] search error:", error);
            show_notification({ type: "error", text: "Failed to search beatmapsets" });
            return null;
        }
    }

    async load() {
        const result = await this.search();

        if (!result) {
            return false;
        }

        const ids = result.beatmapsets.map((bs) => bs.id);
        const key = JSON.stringify(this.build_filter());

        this.set_items(ids, key);
        return true;
    }

    async reload() {
        this.last_filter = null;
        this.last_result = null;
        await this.load();
    }

    async find_item(beatmapset_id: number): Promise<ISelectedBeatmap | null> {
        const ids = get(this.items);
        const index = ids.indexOf(beatmapset_id);

        if (index == -1) {
            return null;
        }

        return {
            md5: String(beatmapset_id),
            index
        };
    }

    is_same_item(item1: ISelectedBeatmap, item2: ISelectedBeatmap) {
        return item1.md5 == item2.md5;
    }

    clear() {
        this.items.set([]);
        this.selected.set(null);
        this.selected_buffer.set([]);
        this.last_filter = null;
        this.last_result = null;
    }
}

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

export const get_beatmap_list = (tab_id: string): BeatmapList => {
    if (!beatmap_managers.has(tab_id)) {
        beatmap_managers.set(tab_id, new BeatmapList(tab_id));
    }

    return beatmap_managers.get(tab_id)!;
};

export const get_beatmapset_list = (tab_id: string): BeatmapSetList => {
    if (!beatmapset_managers.has(tab_id)) {
        beatmapset_managers.set(tab_id, new BeatmapSetList(tab_id));
    }

    return beatmapset_managers.get(tab_id)!;
};

export const cached_beatmaps: Map<string, IBeatmapResult> = new Map();
export const cached_beatmapsets: Map<number, BeatmapSetResult> = new Map();
