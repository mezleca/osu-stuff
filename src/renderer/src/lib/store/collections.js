import { writable, get } from "svelte/store";
import { show_notification } from "./notifications";

const DEFAULT_PENDING_DATA = {
    type: "",
    data: null
};

class CollectionManager {
    constructor() {
        this.needs_update = writable(false);
        this.collections = writable([]);
        this.pending_collections = writable(DEFAULT_PENDING_DATA); // temp added via popup
        this.missing_beatmaps = writable([]); // temp added via popup
        this.missing_collections = writable([]); // temp added via popup
        this.version = writable(0);
        this.query = writable("");
        this.selected = writable({ name: "", maps: [] });
    }

    set(collections) {
        // add extra properties
        for (let i = 0; i < collections.length; i++) {
            collections[i].edit = false;
        }

        this.collections.set(collections);
    }

    set_version(version) {
        this.version.set(version);
    }

    get(name) {
        const desired = get(this.collections).find((c) => c.name == name);
        return desired;
    }

    add(collection) {
        this.collections.update((old) => [...old, collection]);
        this.needs_update.set(true);
    }

    replace(data) {
        this.collections.update((collections) => {
            const updated = [];
            for (const collection of collections) {
                if (collection.name == data.name) {
                    Object.assign(collection, data);
                }
                updated.push(collection);
            }
            return updated;
        });
    }

    select(name) {
        const desired = get(this.collections).find((c) => c.name == name);

        if (!desired) {
            return;
        }

        this.selected.set(desired);
    }

    rename(old_name, new_name) {
        this.collections.update((collections) => {
            const updated = [];
            for (const collection of collections) {
                if (collection.name == old_name) {
                    collection.name == new_name;
                    collection.edit = false;
                }
                updated.push(collection);
            }
            return updated;
        });
    }

    remove(name) {
        const current = get(this.selected);

        if (current.name == name) {
            this.selected.set({ name: "", maps: [] });
        }

        this.collections.update((c) => c.filter((c1) => c1.name != name));
        this.needs_update.set(true);
    }

    remove_beatmap(name, md5) {
        this.collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name != name) {
                    return collection;
                }

                const maps = collection.maps;
                const index = maps.indexOf(md5);

                if (index != -1) {
                    maps.splice(index, 1);
                }

                return { ...collection, maps };
            });
        });

        this.needs_update.set(true);
    }

    async update() {
        const data = get(this.collections);
        const version = get(this.version);

        if (data.length == 0) {
            this.needs_update.set(false);
            return;
        }

        if (version == 0) {
            show_notification({ type: "error", text: "failed to update collection (version == 0)" });
            return;
        }

        const result = await window.osu.update_collections({ collections: data, version: version });

        if (!result.success) {
            show_notification({ type: "error", text: "failed to update collections\n Reason:" + result.reason });
        }

        show_notification({ text: "updated collection" });
        this.needs_update.set(false);
    }

    clear_pending() {
        this.pending_collections.set(DEFAULT_PENDING_DATA);
    }
}

export const collections = new CollectionManager();
