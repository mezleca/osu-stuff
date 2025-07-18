import { writable, derived } from "svelte/store";

// mhm collections
export const collections_store = writable([]);
export const selected_collection_name = writable(null);
export const collection_search = writable("");

export const selected_collection = derived([collections_store, selected_collection_name], ([$collections, $selected_name]) => {
    if (!$selected_name) return null;
    return $collections.find((c) => c.name == $selected_name) || null;
});

export const collection_beatmaps = derived(selected_collection, ($selected) => {
    if (!$selected?.maps) return [];
    return $selected.maps;
});

export const collections = {
    add: (collection) => {
        collections_store.update((old) => [...old, collection]);
    },
    set: (data) => {
        collections_store.update(() => data);
    },
    get: (name) => {
        let result = null;
        collections_store.subscribe((collections) => {
            result = collections.find((c) => c.name == name) || null;
        })();
        return result;
    },
    remove_beatmap: (name, md5) => {
        collections_store.update((collections) => {
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
    },
    remove: (name) => {
        collections_store.update((old) => old.filter((c) => c?.name != name));
        selected_collection_name.update((current) => (current == name ? null : current));
    },
    update: (name, data) => {
        collections_store.update((old) => old.map((c) => (c.name == name ? { ...c, ...data } : c)));
    },
    clear: () => {
        collections_store.set([]);
        selected_collection_name.set(null);
    },
    select: (name) => selected_collection_name.set(name),
    all: collections_store
};
