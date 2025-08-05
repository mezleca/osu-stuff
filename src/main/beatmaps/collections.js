import { config } from "../database/config.js";
import { reader } from "../reader/reader.js";

import path from "path";
import fs from "fs";

let collection_data = null;

export const get_and_update_collections = async (force) => {
    const osu_folder = config.lazer_mode ? config.lazer_path : config.stable_path;

    if (!osu_folder) {
        console.error("[get_collections] failed to get osu! folder");
        return;
    }

    if (collection_data && !force) {
        return collection_data;
    }

    const location = config.lazer_mode ? path.resolve(osu_folder, "client.realm") : path.resolve(osu_folder, "collection.db");

    if (!fs.existsSync(location)) {
        console.log("failed to get collection file in", location);
        return;
    }

    const result = await reader.get_collections_data(location);

    if (result == null) {
        console.log("failed to get collection file");
        return;
    }

    collection_data = result;
    return result;
};

export const update_collections = async (data) => {
    if (!data || data?.collections?.length == 0) {
        return { reason: "0 length", success: false };
    }

    // update collection file
    const result = await reader.update_collections_data(data);

    if (!result) {
        return { success: false, reason: "unknown" };
    }

    // update beatmap object to ensure sync
    collection_data = data;

    return { success: true };
};

export const get_collection_data = async (location, type) => {
    const result = { success: false, data: null, reason: "" };

    if (!fs.existsSync(location)) {
        result.reason = "invalid file location";
        return result;
    }

    const data = type == "db" ? await reader.get_collections_data(location) : await reader.get_osdb_data(location);

    if (!data) {
        result.reason = "failed to read collection data";
        return result;
    }

    result.success = true;
    result.data = type == "db" ? Array.from(data.collections.values()) : data;
    return result;
};
