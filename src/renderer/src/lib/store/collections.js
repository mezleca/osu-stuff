import { writable, get } from "svelte/store";

class CollectionManager {
    constructor() {
        this.needs_update = writable(false);
        this.collections = writable([]);
        this.query = writable("");
        this.selected = writable({ name: "", maps: [] });
    }

    set(collections) {
        this.collections.set(collections);
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
    }
}

export const collections = new CollectionManager();
