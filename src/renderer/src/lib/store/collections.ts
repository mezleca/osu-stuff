import { writable, get, type Writable } from "svelte/store";
import { show_notification } from "./notifications";
import { is_special_key } from "./other";
import type { ICollectionResult } from "@shared/types";

interface ICollectionWithEdit extends ICollectionResult {
    edit: boolean;
}

interface ISelectedCollection {
    name: string;
    beatmaps: string[];
}

const DEFAULT_SELECTED: ISelectedCollection = {
    name: "",
    beatmaps: []
};

class CollectionManager {
    needs_update: Writable<boolean> = writable(false);
    collections: Writable<ICollectionWithEdit[]> = writable([]);
    all_collections: Writable<ICollectionWithEdit[]> = writable([]);
    query: Writable<string> = writable("");
    selected: Writable<ISelectedCollection> = writable({ ...DEFAULT_SELECTED });
    selected_radio: Writable<ISelectedCollection> = writable({ ...DEFAULT_SELECTED });
    missing_beatmaps: Writable<any[]> = writable([]);
    pending_collections: Writable<ICollectionWithEdit[]> = writable();

    set(collections: ICollectionResult[]): void {
        const with_edit: ICollectionWithEdit[] = collections.map((c) => ({
            ...c,
            edit: false
        }));

        this.all_collections.set(with_edit);
        this.filter();
    }

    get(name: string): ICollectionWithEdit | undefined {
        return get(this.all_collections).find((c) => c.name == name);
    }

    get_all(): ICollectionWithEdit[] {
        return get(this.all_collections);
    }

    add(collection: ICollectionResult): void {
        const with_edit: ICollectionWithEdit = {
            ...collection,
            edit: false
        };

        this.all_collections.update((old) => [...old, with_edit]);
        this.needs_update.set(true);
        this.filter();
    }

    replace(data: ICollectionResult): void {
        this.all_collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name == data.name) {
                    return { ...collection, ...data };
                }
                return collection;
            });
        });

        this.needs_update.set(true);
        this.filter();
    }

    select(name: string, is_radio: boolean = false): void {
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

        if (is_radio) {
            this.selected_radio.set(selected_data);
        } else {
            this.selected.set(selected_data);
        }
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

    rename(old_name: string, new_name: string): void {
        this.all_collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name == old_name) {
                    return { ...collection, name: new_name, edit: false };
                }
                return collection;
            });
        });

        const current = get(this.selected);
        if (current.name == old_name) {
            this.selected.set({ ...current, name: new_name });
        }

        const current_radio = get(this.selected_radio);
        if (current_radio.name == old_name) {
            this.selected_radio.set({ ...current_radio, name: new_name });
        }

        this.needs_update.set(true);
        this.filter();
    }

    remove(name: string): void {
        const current = get(this.selected);

        if (current.name == name) {
            this.selected.set({ ...DEFAULT_SELECTED });
        }

        const current_radio = get(this.selected_radio);

        if (current_radio.name == name) {
            this.selected_radio.set({ ...DEFAULT_SELECTED });
        }

        this.all_collections.update((collections) => {
            return collections.filter((c) => c.name != name);
        });

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
                return { ...collection, beatmaps };
            });
        });

        const current = get(this.selected);

        if (current.name == name) {
            const beatmaps = current.beatmaps.filter((hash) => hash != md5);
            this.selected.set({ ...current, beatmaps });
        }

        const current_radio = get(this.selected_radio);

        if (current_radio.name == name) {
            const beatmaps = current_radio.beatmaps.filter((hash) => hash != md5);
            this.selected_radio.set({ ...current_radio, beatmaps });
        }

        this.needs_update.set(true);
        this.filter();
    }

    add_beatmaps(name: string, hashes: string[]): void {
        this.all_collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name != name) {
                    return collection;
                }
                const beatmaps_set = new Set([...collection.beatmaps, ...hashes]);
                return { ...collection, beatmaps: Array.from(beatmaps_set) };
            });
        });

        this.needs_update.set(true);
        this.filter();
    }

    async update(): Promise<void> {
        const current_collections = get(this.all_collections);

        if (current_collections.length == 0) {
            this.needs_update.set(false);
            return;
        }

        const collections_data: ICollectionResult[] = current_collections.map((c) => ({
            name: c.name,
            beatmaps: c.beatmaps
        }));

        try {
            const result = await window.api.invoke("driver:update_collection", collections_data);

            if (!result) {
                show_notification({ type: "error", text: "failed to update collections" });
                return;
            }

            show_notification({ text: "collections updated" });
            this.needs_update.set(false);
        } catch (error) {
            console.error("[collections] update error:", error);
            show_notification({ type: "error", text: "failed to update collections" });
        }
    }

    async load(): Promise<void> {
        try {
            const collections = await window.api.invoke("driver:get_collections");

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
            const result = await window.api.invoke("driver:delete_collection", name);

            if (!result) {
                show_notification({ type: "error", text: `failed to delete collection: ${name}` });
                return;
            }

            this.remove(name);
            show_notification({ text: `collection "${name}" deleted` });
        } catch (error) {
            console.error("[collections] delete error:", error);
            show_notification({ type: "error", text: "failed to delete collection" });
        }
    }

    async create_collection(name: string): Promise<void> {
        if (!name || name.trim() == "") {
            show_notification({ type: "error", text: "invalid collection name" });
            return;
        }

        const existing = this.get(name);
        if (existing) {
            show_notification({ type: "error", text: "collection already exists" });
            return;
        }

        try {
            const result = await window.api.invoke("driver:add_collection", name, []);

            if (!result) {
                show_notification({ type: "error", text: "failed to create collection" });
                return;
            }

            this.add({ name, beatmaps: [] });
            show_notification({ text: `collection "${name}" created` });
        } catch (error) {
            console.error("[collections] create error:", error);
            show_notification({ type: "error", text: "failed to create collection" });
        }
    }

    add_pending(collection: ICollectionWithEdit) {
        this.pending_collections.update((c) => [...c, collection]);
    }

    clear_pending_collections(): void {
        this.pending_collections.set([]);
    }
}

export const collections = new CollectionManager();
