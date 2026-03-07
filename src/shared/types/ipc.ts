import { auth, Modes_names, v2 } from "osu-api-extended";
import { StuffConfig, StuffMirror } from "./config";
import { FetchOptions, IFetchResponse } from "./fetch";
import { ICollectionResult, ILegacyDatabase, IOSDBData, IOsuClient, IProcessorEvent, IBeatmapResult, IBeatmapFilter, IBeatmapSetFilter } from "./osu";
import { IBeatmapDownloader, IDownloadEvent } from "./downloader";
import { GenericResult } from "./basic";
import { OpenDialogOptions, OpenDialogReturnValue } from "electron";
import { UpdateInfo } from "electron-updater";

// osu-api-extended
export type ScoreListBaseParams = {
    mode?: Modes_names;
};

export type ScoreListLeaderboardParams = ScoreListBaseParams & {
    type: "leaderboard";
    leaderboard_type?: "country" | "global" | "friend";
    beatmap_id: number;
    mods?: string[];
};

export type ScoreListUserBestParams = ScoreListBaseParams & {
    type: "user_best";
    user_id: number;
    include_fails?: boolean;
    offset?: number;
    limit?: number;
};

export type ScoreListUserFirstsParams = ScoreListBaseParams & {
    type: "user_firsts";
    user_id: number;
    include_fails?: boolean;
    offset?: number;
    limit?: number;
};

export type UserBeatmapsParams = Parameters<typeof v2.users.beatmaps>[0];
export type UserBeatmapsResult = Awaited<ReturnType<typeof v2.users.beatmaps>>;

export type UsersLookupParams = Parameters<typeof v2.users.lookup>[0];
export type UsersLookupResult = Awaited<ReturnType<typeof v2.users.lookup>>;

export type BeatmapsSearchParams = Extract<Parameters<typeof v2.search>[0], { type: "beatmaps" }>;
export type BeatmapsSearchResult = Awaited<ReturnType<typeof v2.search<BeatmapsSearchParams>>>;

export type BeatmapsetSearchParams = Extract<Parameters<typeof v2.beatmaps.lookup>[0], { type: "set" }>;
export type BeatmapsetSearchResult = Awaited<ReturnType<typeof v2.beatmaps.lookup<BeatmapsetSearchParams>>>;

export type DifficultySearchParams = Extract<Parameters<typeof v2.beatmaps.lookup>[0], { type: "difficulty" }>;
export type DifficultySearchResult = Awaited<ReturnType<typeof v2.beatmaps.lookup<DifficultySearchParams>>>;

type WriteDataParams<T> = {
    location: string;
    data: T;
};

// others
export type WriteOSDBParams = WriteDataParams<IOSDBData>;
export type WriteCollectionParams = WriteDataParams<ICollectionResult[]>;

export interface IExportState {
    is_exporting: boolean;
    current_index: number;
    total: number;
    current_beatmap: string;
}

export interface IExportUpdate {
    current: number;
    total: number;
    text: string;
}

export interface IExportFinish {
    success: boolean;
    count?: number;
    reason?: string;
}

export interface IpcSchema {
    invoke: {
        // binary related stuff
        "reader:read_osdb": {
            params: string;
            result: GenericResult<IOSDBData>;
        };
        "reader:write_osdb": {
            params: WriteOSDBParams;
            result: GenericResult<string>;
        };
        "reader:read_legacy_db": {
            params: string;
            result: GenericResult<ILegacyDatabase>;
        };
        "reader:read_legacy_collection": {
            params: string;
            result: GenericResult<Map<string, ICollectionResult>>;
        };
        "reader:write_legacy_collection": {
            params: WriteCollectionParams;
            result: GenericResult<string>;
        };
        // fetch
        "fetch:get": {
            params: FetchOptions;
            result: IFetchResponse;
        };
        // config
        "config:get": {
            params: undefined;
            result: StuffConfig;
        };
        "config:save": {
            params: Partial<StuffConfig>;
            result: boolean;
        };
        "config:load": {
            params: undefined;
            result: boolean;
        };
        // mirrors
        "mirrors:get": {
            params: undefined;
            result: StuffMirror[];
        };
        "mirrors:save": {
            params: StuffMirror;
            result: boolean;
        };
        "mirrors:delete": {
            params: { name: string };
            result: boolean;
        };
        "mirrors:load": {
            params: undefined;
            result: boolean;
        };
        // clients
        "client:initialize": {
            params: [boolean?, string?];
            result: ReturnType<IOsuClient["initialize"]>;
        };
        "client:is_initialized": {
            params: [string?];
            result: boolean;
        };
        "client:should_update": {
            params: [string?];
            result: boolean;
        };
        "client:get_player_name": {
            params: [string?];
            result: ReturnType<IOsuClient["get_player_name"]>;
        };
        "client:add_collection": {
            params: [string, string[], string?];
            result: ReturnType<IOsuClient["add_collection"]>;
        };
        "client:delete_collection": {
            params: [string, string?];
            result: ReturnType<IOsuClient["delete_collection"]>;
        };
        "client:rename_collection": {
            params: [string, string, string?];
            result: ReturnType<IOsuClient["rename_collection"]>;
        };
        "client:get_collection": {
            params: [string, string?];
            result: ReturnType<IOsuClient["get_collection"]>;
        };
        "client:add_beatmaps_to_collection": {
            params: [string, string[], string?];
            result: boolean;
        };
        "client:get_collections": {
            params: [string?];
            result: ReturnType<IOsuClient["get_collections"]>;
        };
        "client:update_collection": {
            params: [string?];
            result: ReturnType<IOsuClient["update_collection"]>;
        };
        "client:export_collections": {
            params: [ICollectionResult[], string, string?];
            result: ReturnType<IOsuClient["export_collections"]>;
        };
        "client:add_beatmap": {
            params: [IBeatmapResult, string?];
            result: ReturnType<IOsuClient["add_beatmap"]>;
        };
        "client:delete_beatmap": {
            params: [{ md5: string; collection?: string }, string?];
            result: ReturnType<IOsuClient["delete_beatmap"]>;
        };
        "client:has_beatmap": {
            params: [string, string?];
            result: ReturnType<IOsuClient["has_beatmap"]>;
        };
        "client:has_beatmapset": {
            params: [number, string?];
            result: ReturnType<IOsuClient["has_beatmapset"]>;
        };
        "client:has_beatmapsets": {
            params: [number[], string?];
            result: boolean[];
        };
        "client:get_beatmap_by_md5": {
            params: [string, string?];
            result: ReturnType<IOsuClient["get_beatmap_by_md5"]>;
        };
        "client:fetch_beatmaps": {
            params: [string[], string?];
            result: ReturnType<IOsuClient["fetch_beatmaps"]>;
        };
        "client:fetch_beatmapsets": {
            params: [number[], string?];
            result: ReturnType<IOsuClient["fetch_beatmapsets"]>;
        };
        "client:get_beatmap_by_id": {
            params: [number, string?];
            result: ReturnType<IOsuClient["get_beatmap_by_id"]>;
        };
        "client:get_beatmapset": {
            params: [number, string?];
            result: ReturnType<IOsuClient["get_beatmapset"]>;
        };
        "client:get_missing_beatmaps": {
            params: [string | null, string?];
            result: ReturnType<IOsuClient["get_missing_beatmaps"]>;
        };
        "client:get_beatmap_files": {
            params: [string, string?];
            result: ReturnType<IOsuClient["get_beatmap_files"]>;
        };
        "client:get_beatmap_preview_files": {
            params: [string, string?];
            result: ReturnType<IOsuClient["get_beatmap_preview_files"]>;
        };
        "client:search_beatmaps": {
            params: [IBeatmapFilter, string, string?];
            result: ReturnType<IOsuClient["search_beatmaps"]>;
        };
        "client:search_beatmapsets": {
            params: [IBeatmapSetFilter, string?];
            result: ReturnType<IOsuClient["search_beatmapsets"]>;
        };
        "client:export_beatmapset": {
            params: [number, string?];
            result: ReturnType<IOsuClient["export_beatmapset"]>;
        };
        // osu-api-extended
        "web:authenticate": {
            params: Parameters<typeof auth.login>[0];
            result: Awaited<ReturnType<typeof auth.login>>;
        };
        "web:user_beatmaps": {
            params: UserBeatmapsParams;
            result: UserBeatmapsResult;
        };
        "web:players_lookup": {
            params: UsersLookupParams;
            result: UsersLookupResult;
        };
        "web:users_details": {
            params: Parameters<typeof v2.users.details>[0];
            result: Awaited<ReturnType<typeof v2.users.details>>;
        };
        "web:score_list_leaderboard": {
            params: ScoreListLeaderboardParams;
            result: Awaited<ReturnType<typeof v2.scores.list<ScoreListLeaderboardParams>>>;
        };
        "web:score_list_user_best": {
            params: ScoreListUserBestParams;
            result: Awaited<ReturnType<typeof v2.scores.list<ScoreListUserBestParams>>>;
        };
        "web:score_list_user_firsts": {
            params: ScoreListUserFirstsParams;
            result: Awaited<ReturnType<typeof v2.scores.list<ScoreListUserFirstsParams>>>;
        };
        "web:get_beatmapset": {
            params: BeatmapsetSearchParams;
            result: BeatmapsetSearchResult;
        };
        "web:get_beatmap": {
            params: DifficultySearchParams;
            result: DifficultySearchResult;
        };
        "web:search": {
            params: BeatmapsSearchParams;
            result: BeatmapsSearchResult;
        };
        // downloader
        "downloader:resume": {
            params: Parameters<IBeatmapDownloader["resume"]>;
            result: ReturnType<IBeatmapDownloader["resume"]>;
        };
        "downloader:single": {
            params: Parameters<IBeatmapDownloader["add_single"]>;
            result: ReturnType<IBeatmapDownloader["add_single"]>;
        };
        "downloader:add": {
            params: Parameters<IBeatmapDownloader["add_to_queue"]>;
            result: ReturnType<IBeatmapDownloader["add_to_queue"]>;
        };
        "downloader:pause": {
            params: Parameters<IBeatmapDownloader["pause"]>;
            result: ReturnType<IBeatmapDownloader["pause"]>;
        };
        "downloader:get": {
            params: Parameters<IBeatmapDownloader["get_queue"]>;
            result: ReturnType<IBeatmapDownloader["get_queue"]>;
        };
        "downloader:remove": {
            params: Parameters<IBeatmapDownloader["remove_from_queue"]>;
            result: ReturnType<IBeatmapDownloader["remove_from_queue"]>;
        };
        // shell
        "shell:open": {
            params: string;
            result: void;
        };
        "shell:open_path": {
            params: string;
            result: string;
        };
        // window
        "window:minimize": {
            params: undefined;
            result: void;
        };
        "window:maximize": {
            params: undefined;
            result: void;
        };
        // exporter
        "exporter:start": {
            params: [string[]];
            result: void;
        };
        "exporter:cancel": {
            params: undefined;
            result: void;
        };
        "exporter:state": {
            params: undefined;
            result: IExportState;
        };
        "window:unmaximize": {
            params: undefined;
            result: void;
        };
        "window:close": {
            params: undefined;
            result: void;
        };
        "window:state": {
            params: undefined;
            result: "maximized" | "minimized";
        };
        "window:dialog": {
            params: OpenDialogOptions;
            result: OpenDialogReturnValue;
        };
        "window:dev_tools": {
            params: undefined;
            result: void;
        };
        // env
        "env:dev_mode": {
            params: undefined;
            result: boolean;
        };
        // update
        "updater:update": {
            params: undefined;
            result: GenericResult<string>;
        };
        "updater:check": {
            params: undefined;
            result: GenericResult<string>;
        };
        "updater:install": {
            params: undefined;
            result: GenericResult<string>;
        };
    };
    send: {
        "downloader:events": IDownloadEvent;
        "processor:events": IProcessorEvent;
        "export:update": IExportUpdate;
        "export:finish": IExportFinish;
        "updater:new": UpdateInfo;
        "updater:checking": undefined;
        "updater:not_available": UpdateInfo | undefined;
        "updater:finish": GenericResult<string>;
    };
    on: IpcSchema["send"];
}

export type InvokeChannels = keyof IpcSchema["invoke"];
export type SendChannels = keyof IpcSchema["send"];
export type OnChannels = keyof IpcSchema["on"];
export type InvokeParams<T extends InvokeChannels> = IpcSchema["invoke"][T]["params"];
export type InvokeResult<T extends InvokeChannels> = IpcSchema["invoke"][T]["result"];
export type InvokeArgs<T extends InvokeChannels> =
    InvokeParams<T> extends undefined ? [] : InvokeParams<T> extends any[] ? InvokeParams<T> : [InvokeParams<T>];
export type SendPayload<T extends SendChannels> = IpcSchema["send"][T];
export type OnPayload<T extends OnChannels> = IpcSchema["on"][T];

export interface ElectronApi {
    invoke: <T extends InvokeChannels>(channel: T, ...args: InvokeArgs<T>) => Promise<InvokeResult<T>>;
    on: <T extends OnChannels>(channel: T, callback: (payload: OnPayload<T>) => void) => () => void;
}
