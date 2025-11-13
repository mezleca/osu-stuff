import { GenericResult } from "./basic";
import { StuffConfig } from "./config";
import { FetchOptions, FetchResponse } from "./fetch";
import { IBeatmapResult, ExportBeatmapParams, ExportResult, IExportUpdatePayload, IDownloadData, IDownloadUpdate } from "./osu";

export interface IpcSchema {
    invoke: {
        "fetch:get": {
            params: { options: FetchOptions };
            result: FetchResponse;
        };
        "config:save": {
            params: { key: keyof StuffConfig; value: any };
            result: boolean;
        };
        "config:load": {
            params: undefined;
            result: { theme: "light" | "dark"; language: string };
        };
        "export:beatmap": {
            params: ExportBeatmapParams;
            result: ExportResult;
        };
        "export:beatmaps": {
            params: ExportBeatmapParams;
            result: ExportResult;
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
    invoke: <T extends InvokeChannels>(channel: T, ...args: InvokeParams<T> extends undefined ? [] : [InvokeParams<T>]) => Promise<InvokeResult<T>>;
    on: <T extends OnChannels>(channel: T, callback: (payload: OnPayload<T>) => void) => () => void;
}
