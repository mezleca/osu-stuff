import { IBeatmapFilter } from "@shared/types/osu";
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

    // fallback to config
    if (config.get().lazer_mode) {
        return lazer_driver;
    } else {
        return stable_driver;
    }
};

export const get_collections = (custom_driver: string = "") => {
    const driver = get_driver(custom_driver);
    return driver.get_collections();
};

export const get_beatmap_by_md5 = (md5: string, custom_driver: string = "") => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmap_by_md5(md5);
};

export const get_beatmap_by_id = (id: number, custom_driver: string = "") => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmap_by_id(id);
};

export const get_beatmapset = (set_id: number, custom_driver: string = "") => {
    const driver = get_driver(custom_driver);
    return driver.get_beatmapset(set_id);
};

export const search_beatmaps = (options: IBeatmapFilter, custom_driver: string = "") => {
    const driver = get_driver(custom_driver);
    return driver.search_beatmaps(options);
};

export const get_all_beatmaps = (custom_driver: string = "") => {
    const driver = get_driver(custom_driver);
    return driver.get_all_beatmaps();
};
