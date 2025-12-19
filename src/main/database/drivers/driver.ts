import {
    ICollectionResult,
    IBeatmapResult,
    BeatmapSetResult,
    BeatmapFile,
    IBeatmapFilter,
    ISearchResponse,
    ISearchSetResponse,
    IBeatmapSetFilter
} from "@shared/types/osu";

import { BaseDriver } from "./base";
import { config } from "../config";
import { lazer_driver } from "./lazer";
import { stable_driver } from "./stable";

export const get_driver = (custom_driver: string = ""): BaseDriver => {
    switch (custom_driver) {
        case "stable":
            return stable_driver;
        case "lazer":
            return lazer_driver;
    }

    if (config.get().lazer_mode) {
        return lazer_driver;
    } else {
        return stable_driver;
    }
};

export const initialize_driver = async (force: boolean = false, driver: string = ""): Promise<boolean> => {
    return get_driver(driver).initialize(force);
};

export const is_initialized = (driver: string = ""): boolean => {
    return get_driver(driver).is_initialized();
};

export const should_update = (custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.should_update;
};

export const get_player_name = (custom_driver: string = ""): string => {
    const driver = get_driver(custom_driver);
    return driver.get_player_name();
};

export const add_collection = (name: string, beatmaps: string[], custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.add_collection(name, beatmaps);
};

export const delete_collection = (name: string, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.delete_collection(name);
};

export const rename_collection = (old_name: string, new_name: string, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.rename_collection(old_name, new_name);
};

export const delete_beatmap = (options: { md5: string; collection?: string }, custom_driver: string = ""): Promise<boolean> => {
    const driver = get_driver(custom_driver);
    return driver.delete_beatmap(options);
};

export const get_collection = (name: string, custom_driver: string = ""): ICollectionResult | undefined => {
    const driver = get_driver(custom_driver);
    return driver.get_collection(name);
};

export const get_collections = (custom_driver: string = ""): ICollectionResult[] => {
    const driver = get_driver(custom_driver);
    return driver.get_collections();
};

export const update_collection = (custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.update_collection();
};

export const add_beatmaps_to_collection = (collection_name: string, hashes: string[], custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.add_beatmaps_to_collection(collection_name, hashes);
};

export const export_collections = async (collections: ICollectionResult[], type: string, custom_driver: string = ""): Promise<boolean> => {
    const driver = get_driver(custom_driver);
    return driver.export_collections(collections, type);
};

export const add_beatmap = (beatmap: IBeatmapResult, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.add_beatmap(beatmap);
};

export const add_beatmapset = (beatmapset: BeatmapSetResult, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.add_beatmapset(beatmapset);
};

export const has_beatmap = (md5: string, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.has_beatmap(md5);
};

export const has_beatmapset = (id: number, custom_driver: string = ""): boolean => {
    return get_driver(custom_driver).has_beatmapset(id);
};

export const has_beatmapsets = (ids: number[], custom_driver: string = ""): boolean[] => {
    return get_driver(custom_driver).has_beatmapsets(ids);
};

export const get_beatmap_by_md5 = (md5: string, custom_driver: string = ""): Promise<IBeatmapResult | undefined> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmap_by_md5(md5);
};

export const get_beatmap_by_id = (id: number, custom_driver: string = ""): Promise<IBeatmapResult | undefined> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmap_by_id(id);
};

export const get_beatmapset = (id: number, custom_driver: string = ""): Promise<BeatmapSetResult | undefined> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmapset(id);
};

export const get_missing_beatmaps = (name: string | null, custom_driver: string = ""): Promise<string[]> => {
    const driver = get_driver(custom_driver);
    return driver.get_missing_beatmaps(name);
};

export const search_beatmaps = (options: IBeatmapFilter, custom_driver: string = ""): Promise<ISearchResponse> => {
    const driver = get_driver(custom_driver);
    return driver.search_beatmaps(options);
};

export const fetch_beatmaps = (checksums: string[], custom_driver: string = ""): Promise<{ beatmaps: IBeatmapResult[]; invalid: string[] }> => {
    const driver = get_driver(custom_driver);
    return driver.fetch_beatmaps(checksums);
};

export const fetch_beatmapsets = (ids: number[], custom_driver: string = ""): Promise<{ beatmaps: BeatmapSetResult[]; invalid: number[] }> => {
    const driver = get_driver(custom_driver);
    return driver.fetch_beatmapsets(ids);
};

export const search_beatmapsets = (options: IBeatmapSetFilter, custom_driver: string = ""): Promise<ISearchSetResponse> => {
    const driver = get_driver(custom_driver);
    return driver.search_beatmapsets(options);
};

export const get_beatmapset_files = (id: number, custom_driver: string = ""): Promise<BeatmapFile[]> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmapset_files(id);
};

export const export_beatmapset = (id: number, custom_driver: string = ""): Promise<boolean> => {
    const driver = get_driver(custom_driver);
    return driver.export_beatmapset(id);
};
