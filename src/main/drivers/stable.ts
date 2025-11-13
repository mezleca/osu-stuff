import { IBeatmapFilter, IBeatmapResult, BeatmapSetResult, ICollectionResult, BeatmapFile, IAddBeatmapParams, IAddCollectionParams, IDeleteCollectionParams, IFetchBeatmapsParams, IGetBeatmapByIdParams, IGetBeatmapByMd5Params, IGetBeatmapsetFilesParams, IGetBeatmapsetParams, IGetCollectionParams, IUpdateCollectionParams } from "@shared/types/osu";
import { BaseDriver } from "./base";

class StableBeatmapDriver extends BaseDriver {
    constructor() {
        super();
    }

    initialize(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    get_player_name(): string {
        throw new Error("Method not implemented.");
}

    add_collection(params: IAddCollectionParams): boolean {
        throw new Error("Method not implemented.");
    }

    delete_collection(params: IDeleteCollectionParams): boolean {
        throw new Error("Method not implemented.");
    }

    get_collection(params: IGetCollectionParams): ICollectionResult | undefined {
        throw new Error("Method not implemented.");
    }

    get_collections(): ICollectionResult[] {
        throw new Error("Method not implemented.");
    }

    update_collection(params: IUpdateCollectionParams): boolean {
        throw new Error("Method not implemented.");
    }

    add_beatmap(params: IAddBeatmapParams): boolean {
        throw new Error("Method not implemented.");
    }

    get_beatmap_by_md5(params: IGetBeatmapByMd5Params): Promise<IBeatmapResult | undefined> {
        throw new Error("Method not implemented.");
    }

    get_beatmap_by_id(params: IGetBeatmapByIdParams): Promise<IBeatmapResult | undefined> {
        throw new Error("Method not implemented.");
    }

    get_beatmapset(params: IGetBeatmapsetParams): Promise<BeatmapSetResult | undefined> {
        throw new Error("Method not implemented.");
    }

    search_beatmaps(options: IBeatmapFilter): Promise<string[]> {
        throw new Error("Method not implemented.");
    }

    get_all_beatmaps(): Promise<string[]> {
        throw new Error("Method not implemented.");
    }

    get_beatmapset_files(params: IGetBeatmapsetFilesParams): Promise<BeatmapFile[]> {
        throw new Error("Method not implemented.");
    }

    fetch_beatmaps(params: IFetchBeatmapsParams): Promise<IBeatmapResult[]> {
        throw new Error("Method not implemented.");
    }

    dispose(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

export const stable_driver = new StableBeatmapDriver();
