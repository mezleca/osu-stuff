import {
    ICollectionResult,
    IBeatmapResult,
    BeatmapSetResult,
    BeatmapFile,
    BeatmapPreviewFiles,
    IBeatmapFilter,
    ISearchResponse,
    ISearchSetResponse,
    IBeatmapSetFilter
} from "@shared/types/osu";

import { BaseClient } from "./base";
import { config } from "../../database/config";
import { lazer_client } from "./lazer";
import { stable_client } from "./stable";

export const get_client = (custom_client: string = ""): BaseClient => {
    switch (custom_client) {
        case "stable":
            return stable_client;
        case "lazer":
            return lazer_client;
        default:
            return config.get().lazer_mode ? lazer_client : stable_client;
    }
};

export const initialize_client = async (force: boolean = false, client: string = ""): Promise<boolean> => {
    return get_client(client).initialize(force);
};

export const is_client_initialized = (client: string = ""): boolean => {
    return get_client(client).is_initialized();
};

export const should_update = (custom_client: string = ""): boolean => {
    return get_client(custom_client).should_update;
};

export const get_player_name = (custom_client: string = ""): string => {
    return get_client(custom_client).get_player_name();
};

export const add_collection = (name: string, beatmaps: string[], custom_client: string = ""): boolean => {
    return get_client(custom_client).add_collection(name, beatmaps);
};

export const delete_collection = (name: string, custom_client: string = ""): boolean => {
    return get_client(custom_client).delete_collection(name);
};

export const rename_collection = (old_name: string, new_name: string, custom_client: string = ""): boolean => {
    return get_client(custom_client).rename_collection(old_name, new_name);
};

export const delete_beatmap = (options: { md5: string; collection?: string }, custom_client: string = ""): Promise<boolean> => {
    return get_client(custom_client).delete_beatmap(options);
};

export const get_collection = (name: string, custom_client: string = ""): ICollectionResult | undefined => {
    return get_client(custom_client).get_collection(name);
};

export const get_collections = (custom_client: string = ""): ICollectionResult[] => {
    return get_client(custom_client).get_collections();
};

export const update_collection = (custom_client: string = ""): boolean => {
    return get_client(custom_client).update_collection();
};

export const add_beatmaps_to_collection = (collection_name: string, hashes: string[], custom_client: string = ""): boolean => {
    return get_client(custom_client).add_beatmaps_to_collection(collection_name, hashes);
};

export const export_collections = async (collections: ICollectionResult[], type: string, custom_client: string = ""): Promise<boolean> => {
    return get_client(custom_client).export_collections(collections, type);
};

export const add_beatmap = (beatmap: IBeatmapResult, custom_client: string = ""): boolean => {
    return get_client(custom_client).add_beatmap(beatmap);
};

export const add_beatmapset = (beatmapset: BeatmapSetResult, custom_client: string = ""): boolean => {
    return get_client(custom_client).add_beatmapset(beatmapset);
};

export const has_beatmap = (md5: string, custom_client: string = ""): boolean => {
    return get_client(custom_client).has_beatmap(md5);
};

export const has_beatmapset = (id: number, custom_client: string = ""): boolean => {
    return get_client(custom_client).has_beatmapset(id);
};

export const has_beatmapsets = (ids: number[], custom_client: string = ""): boolean[] => {
    return get_client(custom_client).has_beatmapsets(ids);
};

export const get_beatmap_by_md5 = (md5: string, custom_client: string = ""): Promise<IBeatmapResult | undefined> => {
    return get_client(custom_client).get_beatmap_by_md5(md5);
};

export const get_beatmap_by_id = (id: number, custom_client: string = ""): Promise<IBeatmapResult | undefined> => {
    return get_client(custom_client).get_beatmap_by_id(id);
};

export const get_beatmapset = (id: number, custom_client: string = ""): Promise<BeatmapSetResult | undefined> => {
    return get_client(custom_client).get_beatmapset(id);
};

export const get_missing_beatmaps = (name: string | null, custom_client: string = ""): Promise<string[]> => {
    return get_client(custom_client).get_missing_beatmaps(name);
};

export const search_beatmaps = (options: IBeatmapFilter, target: string, custom_client: string = ""): Promise<ISearchResponse> => {
    return get_client(custom_client).search_beatmaps(options, target);
};

export const fetch_beatmaps = (checksums: string[], custom_client: string = ""): Promise<{ beatmaps: IBeatmapResult[]; invalid: string[] }> => {
    return get_client(custom_client).fetch_beatmaps(checksums);
};

export const fetch_beatmapsets = (ids: number[], custom_client: string = ""): Promise<{ beatmaps: BeatmapSetResult[]; invalid: number[] }> => {
    return get_client(custom_client).fetch_beatmapsets(ids);
};

export const search_beatmapsets = (options: IBeatmapSetFilter, custom_client: string = ""): Promise<ISearchSetResponse> => {
    return get_client(custom_client).search_beatmapsets(options);
};

export const get_beatmap_files = (md5: string, custom_client: string = ""): Promise<BeatmapFile[]> => {
    return get_client(custom_client).get_beatmap_files(md5);
};

export const get_beatmap_preview_files = (md5: string, custom_client: string = ""): Promise<BeatmapPreviewFiles> => {
    return get_client(custom_client).get_beatmap_preview_files(md5);
};

export const get_beatmapset_files = (id: number, custom_client: string = ""): Promise<BeatmapFile[]> => {
    return get_client(custom_client).get_beatmapset_files(id);
};

export const export_beatmapset = (id: number, custom_client: string = ""): Promise<boolean> => {
    return get_client(custom_client).export_beatmapset(id);
};
