import { writable, get, type Writable } from "svelte/store";
import { show_notification } from "./notifications";
import { is_special_key } from "./other";
import type { ICollectionResult } from "@shared/types";
import type { ICollectionWithEdit, IMissingCache, ISelectedCollection } from "@shared/types";

export type { ICollectionWithEdit };

const DEFAULT_SELECTED: ISelectedCollection = {
    name: "",
    beatmaps: []
};

class CollectionManager {
    needs_update: Writable<boolean> = writable(false);
    collections: Writable<ICollectionWithEdit[]> = writable([]);
    all_collections: Writable<ICollectionWithEdit[]> = writable([]);
    query: Writable<string> = writable("");
    private selected_states: Map<string, Writable<ISelectedCollection>> = new Map();
    private missing_cache: Map<string, IMissingCache> = new Map();

    private get_now(): number {
        return Date.now();
    }

    private normalize_collection(collection: ICollectionResult): ICollectionResult {
        return {
            ...collection,
            last_modified: collection.last_modified ?? 0
        };
    }

    private invalidate_missing(name: string): void {
        this.missing_cache.delete(name);
    }

    private sync_missing_cache_with_collections(collections: ICollectionWithEdit[]): void {
        const names = new Set(collections.map((collection) => collection.name));

        for (const name of this.missing_cache.keys()) {
            if (!names.has(name)) {
                this.missing_cache.delete(name);
            }
        }
    }

    private async get_missing_count_for_collection(collection: ICollectionWithEdit): Promise<number> {
        const cached = this.missing_cache.get(collection.name);

        if (cached && collection.last_modified <= cached.last_checked_modified) {
            return cached.count;
        }

        const missing = await window.api.invoke("client:get_missing_beatmaps", collection.name);
        const count = missing?.length ?? 0;

        this.missing_cache.set(collection.name, {
            count,
            last_checked_modified: collection.last_modified
        });

        return count;
    }

    get_selected_store(context: string): Writable<ISelectedCollection> {
        const existing = this.selected_states.get(context);

        if (existing) {
            return existing;
        }

        const store = writable({ ...DEFAULT_SELECTED });
        this.selected_states.set(context, store);
        return store;
    }

    async get_missing(): Promise<{ name: string; count: number }[]> {
        const all = get(this.all_collections);
        const result: { name: string; count: number }[] = [];

        for (const collection of all) {
            const count = await this.get_missing_count_for_collection(collection);
            if (count > 0) {
                result.push({ name: collection.name, count });
            }
        }

        return result;
    }

    async get_total_missing(): Promise<number> {
        const all = get(this.all_collections);
        let total = 0;

        for (const collection of all) {
            total += await this.get_missing_count_for_collection(collection);
        }

        return total;
    }

    set(collections: ICollectionResult[]): void {
        const with_edit: ICollectionWithEdit[] = collections.map((collection) => ({
            ...this.normalize_collection(collection),
            edit: false
        }));

        this.all_collections.set(with_edit);
        this.sync_missing_cache_with_collections(with_edit);
        this.filter();
    }

    get(name: string): ICollectionWithEdit | undefined {
        return get(this.all_collections).find((c) => c.name == name);
    }

    has(name: string): boolean {
        return get(this.all_collections).some((c) => c.name == name);
    }

    get_all(): ICollectionWithEdit[] {
        return get(this.all_collections);
    }

    add(collection: ICollectionResult): void {
        const with_edit: ICollectionWithEdit = {
            ...this.normalize_collection(collection),
            edit: false
        };

        this.all_collections.update((old) => [...old, with_edit]);
        this.invalidate_missing(with_edit.name);
        this.needs_update.set(true);
        this.filter();
    }

    replace(data: ICollectionResult, ignore_update: boolean = false): void {
        const normalized = this.normalize_collection(data);

        this.all_collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name == normalized.name) {
                    return { ...collection, ...normalized };
                }

                return collection;
            });
        });

        this.invalidate_missing(normalized.name);

        if (!ignore_update) {
            this.needs_update.set(true);
        }

        this.filter();
    }

    select(name: string, context: string = "collections"): void {
        let selected_data: ISelectedCollection;

        if (is_special_key(name)) {
            selected_data = { name, beatmaps: [] };
        } else {
            const collection = this.get(name);
            if (!collection) {
                console.warn(`[collections] collection not found: ${name}`);
                return;
            }
            selected_data = { name: collection.name, beatmaps: collection.beatmaps };
        }

        const store = this.get_selected_store(context);
        store.set(selected_data);
    }

    filter(): void {
        const query = get(this.query);
        const all = get(this.all_collections);

        if (query == "") {
            this.collections.set(all);
            return;
        }

        const query_lower = query.toLowerCase();
        const filtered = all.filter((c) => c.name.toLowerCase().includes(query_lower));

        this.collections.set(filtered);
    }

    async rename(old_name: string, new_name: string): Promise<boolean> {
        const now = this.get_now();

        this.all_collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name == old_name) {
                    return { ...collection, name: new_name, edit: false, last_modified: now };
                }

                return collection;
            });
        });

        for (const store of this.selected_states.values()) {
            const current = get(store);

            if (current.name == old_name) {
                store.set({ ...current, name: new_name });
            }
        }

        this.invalidate_missing(old_name);
        this.invalidate_missing(new_name);
        this.needs_update.set(true);
        this.filter();

        const result = await window.api.invoke("client:rename_collection", old_name, new_name);

        if (!result) {
            console.error("failed to rename collection");
            return false;
        }

        return true;
    }

    async remove(name: string): Promise<void> {
        for (const store of this.selected_states.values()) {
            const current = get(store);

            if (current.name == name) {
                store.set({ ...DEFAULT_SELECTED });
            }
        }

        this.all_collections.update((collections) => {
            return collections.filter((c) => c.name != name);
        });

        this.invalidate_missing(name);
        this.needs_update.set(true);
        this.filter();
    }

    remove_beatmap(name: string, md5: string): void {
        this.all_collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name != name) {
                    return collection;
                }

                const beatmaps = collection.beatmaps.filter((hash) => hash != md5);
                return { ...collection, beatmaps, last_modified: this.get_now() };
            });
        });

        for (const store of this.selected_states.values()) {
            const current = get(store);

            if (current.name == name) {
                const beatmaps = current.beatmaps.filter((hash) => hash != md5);
                store.set({ ...current, beatmaps });
            }
        }

        this.invalidate_missing(name);
        this.needs_update.set(true);
        this.filter();
    }

    async add_beatmaps(name: string, hashes: string[]): Promise<void> {
        this.all_collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name != name) {
                    return collection;
                }

                const beatmaps_set = new Set([...collection.beatmaps, ...hashes]);
                return {
                    ...collection,
                    beatmaps: Array.from(beatmaps_set),
                    last_modified: this.get_now()
                };
            });
        });

        await window.api.invoke("client:add_beatmaps_to_collection", name, hashes);

        this.invalidate_missing(name);
        this.needs_update.set(true);
        this.filter();
    }

    async update(): Promise<void> {
        const current_collections = get(this.all_collections);

        if (current_collections.length == 0) {
            this.needs_update.set(false);
            return;
        }

        try {
            const result = await window.api.invoke("client:update_collection");

            if (!result) {
                show_notification({ type: "error", text: "failed to update collections" });
                return;
            }

            this.all_collections.update((all) => all.map((collection) => ({ ...collection, last_modified: 0 })));

            for (const [name, cached] of this.missing_cache) {
                this.missing_cache.set(name, { ...cached, last_checked_modified: 0 });
            }

            show_notification({ type: "success", text: "collections updated" });
            this.needs_update.set(false);
            this.filter();
        } catch (error) {
            console.error("[collections] update error:", error);
            show_notification({ type: "error", text: "failed to update collections" });
        }
    }

    async load(): Promise<void> {
        try {
            const collections = await window.api.invoke("client:get_collections");

            if (!collections) {
                console.warn("[collections] failed to load collections");
                return;
            }

            this.set(collections);
        } catch (error) {
            console.error("[collections] load error:", error);
            show_notification({ type: "error", text: "failed to load collections" });
        }
    }

    async delete_collection(name: string): Promise<void> {
        try {
            const result = await window.api.invoke("client:delete_collection", name);

            if (!result) {
                show_notification({ type: "error", text: `failed to delete collection: ${name}` });
                return;
            }

            await this.remove(name);
            show_notification({ type: "success", text: `collection "${name}" deleted` });
        } catch (error) {
            console.error("[collections] delete error:", error);
            show_notification({ type: "error", text: "failed to delete collection" });
        }
    }

    async create_collection(name: string): Promise<boolean> {
        if (!name || name.trim() == "") {
            show_notification({ type: "error", text: "invalid collection name" });
            return false;
        }

        const existing = this.get(name);

        if (existing) {
            show_notification({ type: "error", text: "collection already exists" });
            return false;
        }

        try {
            const result = await window.api.invoke("client:add_collection", name, []);

            if (!result) {
                show_notification({ type: "error", text: "failed to create collection" });
                return false;
            }

            this.add({ name, beatmaps: [], last_modified: this.get_now() });
            return true;
        } catch (error) {
            console.error("[collections] create error:", error);
            show_notification({ type: "error", text: "failed to create collection" });
            return false;
        }
    }
}

export const collections = new CollectionManager();
