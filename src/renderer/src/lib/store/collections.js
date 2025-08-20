import { writable, get } from "svelte/store";
import { show_notification } from "./notifications";
import { config } from "./config";
import { is_special_key } from "./other";

const DEFAULT_PENDING_DATA = {
    type: "",
    data: null
};

const DEFAULT_SELECTED_COLLECTION = {
    name: "",
    maps: []
};

const create_selected_data = (name = "", data = []) => {
    return { ...DEFAULT_PENDING_DATA, name, data };
};

class CollectionManager {
    constructor() {
        this.needs_update = writable(false);
        this.hide_remove = writable(false); // hide remove beatmap option from context menu
        this.collections = writable([]);
        this.all_collections = writable([]);
        this.pending_collections = writable(DEFAULT_PENDING_DATA); // temp added via popup
        this.missing_beatmaps = writable([]); // temp added via popup
        this.missing_collections = writable([]); // temp added via popup
        this.version = writable(0);
        this.query = writable("");
        this.selected = writable(DEFAULT_SELECTED_COLLECTION);
        this.selected_radio = writable(DEFAULT_SELECTED_COLLECTION); // not the best way but works
    }

    // update store to use our collection array
    set(collections) {
        // ensure edit variable exists
        for (let i = 0; i < collections.length; i++) {
            collections[i].edit = false;
        }

        this.all_collections.set(collections);
    }

    // need this to write the binary file
    set_version(version) {
        this.version.set(version);
    }

    // get collection by name
    get(name) {
        return get(this.all_collections).find((c) => c.name == name);
    }

    // add new collection
    add(collection) {
        this.all_collections.update((old) => [...old, collection]);
        this.needs_update.set(true);
    }

    // update a collection that already exists
    replace(data) {
        this.all_collections.update((collections) => {
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

    // select collection (default or radio)
    select(name, is_radio) {
        const desired = is_special_key(name) ? create_selected_data(name) : get(this.all_collections).find((c) => c.name == name);

        if (desired) {
            if (is_radio) this.selected_radio.set(desired);
            else this.selected.set(desired);
        }
    }

    // filter collections by name
    filter() {
        const query = get(this.query);
        const collections = get(this.all_collections);

        if (query == "") {
            this.collections.set(collections);
        } else {
            this.collections.set(collections.filter((c) => c.name.toLowerCase()?.includes(query.toLowerCase())));
        }
    }

    rename(old_name, new_name) {
        this.all_collections.update((collections) => {
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

        this.all_collections.update((c) => c.filter((c1) => c1.name != name));
        this.needs_update.set(true);
    }

    // remove beatmap from a specific collection
    remove_beatmap(name, md5) {
        this.all_collections.update((collections) => {
            return collections.map((collection) => {
                if (collection.name != name) {
                    return collection;
                }

                const maps = collection.maps;
                const index = maps.indexOf(md5);

                console.log(index, md5);
                if (index != -1) {
                    maps.splice(index, 1);
                }

                return { ...collection, maps };
            });
        });

        this.needs_update.set(true);
    }

    // update binary file (or realm database if lazer)
    async update() {
        const current_collections = get(this.all_collections);
        const version = get(this.version);

        if (current_collections.length == 0) {
            this.needs_update.set(false);
            return;
        }

        if (!version && !config.get("lazer_mode")) {
            show_notification({ type: "error", text: "failed to update collection (invalid version)" });
            return;
        }

        const result = await window.osu.update_collections({ collections: current_collections, version: version });

        if (!result.success) {
            show_notification({ type: "error", text: `failed to update collections ${result.reason}` });
        }

        show_notification({ text: "updated collection" });
        this.needs_update.set(false);
    }

    // remove all pending collections
    clear_pending() {
        this.pending_collections.set(DEFAULT_PENDING_DATA);
    }
}

export const collections = new CollectionManager();
