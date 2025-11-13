import { StuffConfig } from "./config";
import { FetchOptions } from "./fetch";
import { IDownloadData, IDownloadUpdate, IExportUpdatePayload, IOsuDriver } from "./osu";

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
            params: [string?];
            result: string;
        };
        "driver:add_collection": {
            params: [Parameters<IOsuDriver["add_collection"]>, string?];
            result: ReturnType<IOsuDriver["add_collection"]>;
        };
        "driver:delete_collection": {
            params: [Parameters<IOsuDriver["delete_collection"]>, string?];
            result: ReturnType<IOsuDriver["delete_collection"]>;
        };
        "driver:get_collection": {
            params: [Parameters<IOsuDriver["get_collection"]>, string?];
            result: ReturnType<IOsuDriver["get_collection"]>;
        };
        "driver:get_collections": {
            params: [string?];
            result: ReturnType<IOsuDriver["get_collections"]>;
        };
        "driver:update_collection": {
            params: [Parameters<IOsuDriver["update_collection"]>, string?];
            result: ReturnType<IOsuDriver["update_collection"]>;
        };
        "driver:export_collections": {
            params: [Parameters<IOsuDriver["export_collections"]>, string?];
            result: ReturnType<IOsuDriver["export_collections"]>;
        };
        "driver:add_beatmap": {
            params: [Parameters<IOsuDriver["add_beatmap"]>, string?];
            result: ReturnType<IOsuDriver["add_beatmap"]>;
        };
        "driver:get_beatmap_by_md5": {
            params: [Parameters<IOsuDriver["get_beatmap_by_md5"]>, string?];
            result: ReturnType<IOsuDriver["get_beatmap_by_md5"]>;
        };
        "driver:get_beatmap_by_id": {
            params: [Parameters<IOsuDriver["get_beatmap_by_id"]>, string?];
            result: ReturnType<IOsuDriver["get_beatmap_by_id"]>;
        };
        "driver:get_beatmapset": {
            params: [Parameters<IOsuDriver["get_beatmapset"]>, string?];
            result: ReturnType<IOsuDriver["get_beatmapset"]>;
        };
        "driver:search_beatmaps": {
            params: [Parameters<IOsuDriver["search_beatmaps"]>, string?];
            result: ReturnType<IOsuDriver["search_beatmaps"]>;
        };
        "driver:get_all_beatmaps": {
            params: [string?];
            result: ReturnType<IOsuDriver["get_all_beatmaps"]>;
        };
        "driver:fetch_beatmaps": {
            params: [Parameters<IOsuDriver["fetch_beatmaps"]>, string?];
            result: ReturnType<IOsuDriver["fetch_beatmaps"]>;
        };
    };
    send: {
        "downloader:get": { data: IDownloadUpdate };
        "downloader:update": { data: IDownloadData; type: string };
        "export:update": IExportUpdatePayload;
    };
    on: IpcSchema["send"];
}

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
        ...args: InvokeParams<T> extends undefined ? [] : InvokeParams<T> extends any[] ? InvokeParams<T> : [InvokeParams<T>]
    ) => Promise<InvokeResult<T>>;
    on: <T extends OnChannels>(channel: T, callback: (payload: OnPayload<T>) => void) => () => void;
}
