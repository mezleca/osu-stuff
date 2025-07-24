import { writable, get } from "svelte/store";
import { show_notification } from "./notifications";

class CollectionManager {
    constructor() {
        this.needs_update = writable(false);
        this.collections = writable([]);
        this.version = writable(0);
        this.query = writable("");
        this.selected = writable({ name: "", maps: [] });
    }

    set(collections) {
        this.collections.set(collections);
    }

    set_version(version) {
        this.version.set(version);
    }

    get(name) {
        let result = null;

        this.collections.subscribe((collections) => {
            result = collections.find((c) => c.name == name) || null;
        })();

        return result;
    }

    add(collection) {
        this.collections.update((old) => [...old, collection]);
        this.needs_update.set(true);
    }

    select(name) {
        const desired = get(this.collections).find((c) => c.name == name);

        if (!desired) {
            return;
        }

        this.selected.set(desired);
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
}

export const collections = new CollectionManager();
