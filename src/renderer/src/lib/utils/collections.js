import { collections } from "../store/collections";

export const get_collections = async (force) => {
    // update collection store
    const collection_data = await window.osu.get_collections();

    if (!collection_data) {
        return;
    }

    console.log(collection_data);

    const collections_array = Array.from(collection_data.collections.values());
    const version = collection_data.version;

    collections.set(collections_array);
    collections.set_version(version);

    const beatmaps_data = await window.osu.get_beatmaps(force);

    if (!beatmaps_data) {
        console.log("failed to initialize");
        return;
    }
};
