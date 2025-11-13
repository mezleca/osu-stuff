import { StuffConfig } from "./config";
import { FetchOptions } from "./fetch";
import { ExportBeatmapParams, ExportResult, IExportUpdatePayload, IDownloadData, IDownloadUpdate, IGetPlayerNameParams, IAddCollectionParams, IGetCollectionParams, ICollectionResult, IUpdateCollectionParams, IExportCollectionsParams, IAddBeatmapParams, IGetBeatmapByMd5Params, IGetBeatmapsetParams, IBeatmapResult, BeatmapSetResult, ISearchBeatmapsParams, IFetchBeatmapsParams, IGetBeatmapByIdParams } from "./osu";

export type IFetchResponse = {
    success: boolean;
    status: number;
    error?: string;
    data?: any;
    headers: Record<string, string>;
};

export type ConfigSaveParams = Partial<StuffConfig>; 

export interface IpcSchema {
    invoke: {
        // fetch
        "fetch:get": {
            params: FetchOptions;
            result: IFetchResponse;
        };
        // config
        "config:save": {
            params: ConfigSaveParams;
            result: boolean;
        };
        "config:load": {
            params: undefined;
            result: boolean;
        };
        // drivers
        "driver:get_player_name": {
            params: [IGetPlayerNameParams, string?];
            result: string;
        };
        "driver:add_collection": {
            params: [IAddCollectionParams, string?];
            result: boolean;
        };
        "driver:delete_collection": {
            params: [IAddCollectionParams, string?];
            result: boolean;
        };
        "driver:get_collection": {
            params: [IGetCollectionParams, string?];
            result: ICollectionResult | undefined;
        };
        "driver:get_collections": {
            params: [string?];
            result: ICollectionResult[];
        };
        "driver:update_collection": {
            params: [IUpdateCollectionParams, string?];
            result: boolean;
        };
        "driver:export_collections": {
            params: [IExportCollectionsParams, string?];
            result: Promise<boolean>;
        };
        "driver:add_beatmap": {
            params: [IAddBeatmapParams, string?];
            result: boolean;
        };
        "driver:get_beatmap_by_md5": {
            params: [IGetBeatmapByMd5Params, string?];
            result: Promise<IBeatmapResult | undefined>;
        };
        "driver:get_beatmap_by_id": {
            params: [IGetBeatmapByIdParams, string?];
            result: Promise<IBeatmapResult | undefined>;
        };
        "driver:get_beatmapset": {
            params: [IGetBeatmapsetParams, string?];
            result: Promise<BeatmapSetResult | undefined>;
        };
        "driver:search_beatmaps": {
            params: [ISearchBeatmapsParams, string?];
            result: Promise<string[]>;
        };
        "driver:get_all_beatmaps": {
            params: [string?];
            result: string[];
        };
        "driver:fetch_beatmaps": {
            params: [IFetchBeatmapsParams, string?];
            result: IBeatmapResult[];
        };
        "driver:export_beatmap": {
            params: [ExportBeatmapParams, string?];
            result: ExportResult;
        };
    };
    send: {
        "downloader:get": { data: IDownloadUpdate };
        "downloader:update": { data: IDownloadData; type: string };
        "export:update": IExportUpdatePayload;
    };
    on: IpcSchema["send"];
};

export type InvokeChannels = keyof IpcSchema["invoke"];
export type SendChannels = keyof IpcSchema["send"];
export type OnChannels = keyof IpcSchema["on"];
export type InvokeParams<T extends InvokeChannels> = IpcSchema["invoke"][T]["params"];
export type InvokeResult<T extends InvokeChannels> = IpcSchema["invoke"][T]["result"];
export type SendPayload<T extends SendChannels> = IpcSchema["send"][T];
export type OnPayload<T extends OnChannels> = IpcSchema["on"][T];

export interface ElectronApi {
    invoke: <T extends InvokeChannels>(
        channel: T,
        ...args: InvokeParams<T> extends undefined 
            ? [] 
            : InvokeParams<T> extends any[] 
                ? InvokeParams<T> 
                : [InvokeParams<T>]
    ) => Promise<InvokeResult<T>>;
    on: <T extends OnChannels>(channel: T, callback: (payload: OnPayload<T>) => void) => () => void;
};