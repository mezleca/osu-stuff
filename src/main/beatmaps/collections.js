import { config } from "../database/config.js";
import { reader } from "../reader/reader.js";
import { get_beatmap_by_md5, get_playername } from "./beatmaps.js";

import path from "path";
import fs from "fs";

let collection_data = null;

export const get_and_update_collections = async (force) => {
    const osu_folder = config.lazer_mode ? config.lazer_path : config.stable_path;

    if (!osu_folder) {
        console.error("[get_collections] failed to get osu! folder");
        return false;
    }

    if (collection_data && !force) {
        return collection_data;
    }

    const location = config.lazer_mode ? path.resolve(osu_folder, "client.realm") : path.resolve(osu_folder, "collection.db");

    if (!fs.existsSync(location)) {
        console.log("failed to get collection file in", location);
        return false;
    }

    const result = await reader.get_collections_data(location);

    if (!result) {
        console.log("failed to get collection file");
        return false;
    }

    collection_data = result;
    return result;
};

export const update_collections = async (data) => {
    if (!data || data?.collections?.length == 0) {
        return { reason: "invalid collection object", success: false };
    }

    // update collection file
    const result = await reader.update_collections_data(data);

    if (!result.success) {
        return result;
    }

    // update beatmap object to ensure sync
    collection_data = data;
    return result;
};

export const get_collection_data = async (location, type) => {
    const result = { success: false, data: null, reason: "" };

    if (!fs.existsSync(location)) {
        result.reason = "invalid file location";
        return result;
    }

    const data = type == "db" ? await reader.get_collections_data(location, true) : await reader.get_osdb_data(location);

    if (!data) {
        result.reason = "failed to read collection data";
        return result;
    }

    result.success = true;
    result.data = type == "db" ? Array.from(data.collections.values()) : data;
    return result;
};

export const export_collection = async (collections, type) => {
    const result = { success: false, data: null, reason: "" };

    if (collections.length == 0) {
        result.reason = "invalid collection data";
        return result;
    }

    const version = collection_data.version;
    const data = { version, collections };

    // osdb also needs more bullshit even on minimal mode (prob needed to display on osu! stats or something)
    if (type == "osdb") {
        const beatmaps = [],
            hashes = [];
        for (const collection of collections) {
            for (const hash of collection.maps) {
                const beatmap = get_beatmap_by_md5(hash);
                // @NOTE: not sure if i do this on v1 but i think its better to just ignore this beatmap if not downloaded
                if (beatmap) {
                    beatmaps.push(beatmap);
                    hashes.push(hash);
                }
            }
            // add our update data to the new collection
            collection.beatmaps = beatmaps;
            collection.hash_only_beatmaps = hashes;
            collection.last_editor = get_playername();

            // cleanup
            delete collection.maps;
        }
    }

    const { success, reason, buffer } = type == "db" ? reader.write_collections_data(data) : reader.write_osdb_data(data, "o!dm8min");

    if (!success) {
        result.reason = reason;
        return result;
    }

    // create export if doesn't already exist
    if (!fs.existsSync(config.export_path)) {
        fs.mkdirSync(config.export_path, { recursive: true });
    }

    const final_name = data.collections.map((c) => c.name).join("-") + `.${type}`;
    const location = path.resolve(config.export_path, final_name);

    fs.writeFileSync(location, buffer);

    result.success = true;
    return result;
};
