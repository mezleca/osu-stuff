import {
    IAddCollectionParams,
    IDeleteCollectionParams,
    IGetCollectionParams,
    ICollectionResult,
    IUpdateCollectionParams,
    IExportCollectionsParams,
    IAddBeatmapParams,
    IGetBeatmapByMd5Params,
    IGetBeatmapByIdParams,
    IBeatmapResult,
    IGetBeatmapsetParams,
    BeatmapSetResult,
    IGetBeatmapsetFilesParams,
    BeatmapFile,
    IFetchBeatmapsParams,
    IBeatmapFilter
} from "@shared/types/osu";

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

export const add_collection = (params: IAddCollectionParams, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.add_collection(params);
};

export const delete_collection = (params: IDeleteCollectionParams, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.delete_collection(params);
};

export const get_collection = (params: IGetCollectionParams, custom_driver: string = ""): ICollectionResult | undefined => {
    const driver = get_driver(custom_driver);
    return driver.get_collection(params);
};

export const get_collections = (custom_driver: string = ""): ICollectionResult[] => {
    const driver = get_driver(custom_driver);
    return driver.get_collections();
};

export const update_collection = (params: IUpdateCollectionParams, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.update_collection(params);
};

export const export_collections = async (params: IExportCollectionsParams, custom_driver: string = ""): Promise<boolean> => {
    const driver = get_driver(custom_driver);
    return await driver.export_collections(params);
};

export const add_beatmap = (params: IAddBeatmapParams, custom_driver: string = ""): boolean => {
    const driver = get_driver(custom_driver);
    return driver.add_beatmap(params);
};

export const get_beatmap_by_md5 = (params: IGetBeatmapByMd5Params, custom_driver: string = ""): Promise<IBeatmapResult | undefined> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmap_by_md5(params);
};

export const get_beatmap_by_id = (params: IGetBeatmapByIdParams, custom_driver: string = ""): Promise<IBeatmapResult | undefined> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmap_by_id(params);
};

export const get_beatmapset = (params: IGetBeatmapsetParams, custom_driver: string = ""): Promise<BeatmapSetResult | undefined> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmapset(params);
};

export const search_beatmaps = (params: IBeatmapFilter, custom_driver: string = ""): Promise<string[]> => {
    const driver = get_driver(custom_driver);
    return driver.search_beatmaps(params);
};

export const get_all_beatmaps = (custom_driver: string = ""): Promise<string[]> => {
    const driver = get_driver(custom_driver);
    return driver.get_all_beatmaps();
};

export const get_beatmapset_files = (params: IGetBeatmapsetFilesParams, custom_driver: string = ""): Promise<BeatmapFile[]> => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmapset_files(params);
};

export const fetch_beatmaps = (params: IFetchBeatmapsParams, custom_driver: string = ""): Promise<IBeatmapResult[]> => {
    const driver = get_driver(custom_driver);
    return driver.fetch_beatmaps(params);
};