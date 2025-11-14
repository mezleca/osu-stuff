import { ICollectionResult, IBeatmapResult, BeatmapSetResult, BeatmapFile, IBeatmapFilter, ISearchResponse } from "@shared/types/osu";

import { BaseDriver } from "./base";
import { config } from "../database/config";
import { lazer_driver } from "./lazer";
import { stable_driver } from "./stable";

export const initialize_driver = async (custom_driver: string = ""): Promise<void> => {
    const driver = get_driver(custom_driver);
    await driver.initialize();
};

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

export const get_collection = (name: string, custom_driver: string = ""): ICollectionResult | undefined => {
    const driver = get_driver(custom_driver);
    return driver.get_collection(name);
};

export const get_collections = (custom_driver: string = ""): ICollectionResult[] => {
    const driver = get_driver(custom_driver);
    return driver.get_collections();
};

export const update_collection = (collections: ICollectionResult[], custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.update_collection(collections);
};

export const export_collections = async (collections: ICollectionResult[], type: string, custom_driver: string = ""): Promise<boolean> => {
    const driver = get_driver(custom_driver);
    return await driver.export_collections(collections, type);
};

export const add_beatmap = (beatmap: IBeatmapResult, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.add_beatmap(beatmap);
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

export const search_beatmaps = (options: IBeatmapFilter, custom_driver: string = ""): Promise<ISearchResponse> => {
    const driver = get_driver(custom_driver);
    return driver.search_beatmaps(options);
};

export const get_all_beatmaps = (custom_driver: string = ""): Promise<string[]> => {
    const driver = get_driver(custom_driver);
    return driver.get_all_beatmaps();
};

export const get_beatmapset_files = (id: number, custom_driver: string = ""): Promise<BeatmapFile[]> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmapset_files(id);
};

export const fetch_beatmaps = (checksums: string[], custom_driver: string = ""): Promise<IBeatmapResult[]> => {
    const driver = get_driver(custom_driver);
    return driver.fetch_beatmaps(checksums);
};

export const export_beatmapset = (id: number, custom_driver: string = ""): Promise<boolean> => {
    const driver = get_driver(custom_driver);
    return driver.export_beatmapset(id);
};
