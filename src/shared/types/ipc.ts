import { auth, Modes_names, v2 } from "osu-api-extended";
import { StuffConfig, StuffMirror } from "./config";
import { FetchOptions, IFetchResponse } from "./fetch";
import { ICollectionResult, ILegacyDatabase, IOSDBData, IOsuDriver, IProcessorEvent, IBeatmapResult, IBeatmapFilter, IBeatmapSetFilter } from "./osu";
import { IBeatmapDownloader, IDownloadEvent } from "./downloader";
import { GenericResult } from "./basic";
import { NewUpdateResponse } from "./update";
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
        // drivers
        "driver:initialize": {
            params: [boolean?, string?];
            result: ReturnType<IOsuDriver["initialize"]>;
        };
        "driver:is_initialized": {
            params: [string?];
            result: boolean;
        };
        "driver:should_update": {
            params: [string?];
            result: boolean;
        };
        "driver:get_player_name": {
            params: [string?];
            result: ReturnType<IOsuDriver["get_player_name"]>;
        };
        "driver:add_collection": {
            params: [string, string[], string?];
            result: ReturnType<IOsuDriver["add_collection"]>;
        };
        "driver:delete_collection": {
            params: [string, string?];
            result: ReturnType<IOsuDriver["delete_collection"]>;
        };
        "driver:rename_collection": {
            params: [string, string, string?];
            result: ReturnType<IOsuDriver["rename_collection"]>;
        };
        "driver:get_collection": {
            params: [string, string?];
            result: ReturnType<IOsuDriver["get_collection"]>;
        };
        "driver:add_beatmaps_to_collection": {
            params: [string, string[], string?];
            result: boolean;
        };
        "driver:get_collections": {
            params: [string?];
            result: ReturnType<IOsuDriver["get_collections"]>;
        };
        "driver:update_collection": {
            params: [];
            result: ReturnType<IOsuDriver["update_collection"]>;
        };
        "driver:export_collections": {
            params: [ICollectionResult[], string, string?];
            result: ReturnType<IOsuDriver["export_collections"]>;
        };
        "driver:add_beatmap": {
            params: [IBeatmapResult, string?];
            result: ReturnType<IOsuDriver["add_beatmap"]>;
        };
        "driver:delete_beatmap": {
            params: [{ md5: string; collection?: string }, string?];
            result: ReturnType<IOsuDriver["delete_beatmap"]>;
        };
        "driver:has_beatmap": {
            params: [string, string?];
            result: ReturnType<IOsuDriver["has_beatmap"]>;
        };
        "driver:has_beatmapset": {
            params: [number, string?];
            result: ReturnType<IOsuDriver["has_beatmapset"]>;
        };
        "driver:has_beatmapsets": {
            params: [number[], string?];
            result: boolean[];
        };
        "driver:get_beatmap_by_md5": {
            params: [string, string?];
            result: ReturnType<IOsuDriver["get_beatmap_by_md5"]>;
        };
        "driver:fetch_beatmaps": {
            params: [string[], string?];
            result: ReturnType<IOsuDriver["fetch_beatmaps"]>;
        };
        "driver:fetch_beatmapsets": {
            params: [number[], string?];
            result: ReturnType<IOsuDriver["fetch_beatmapsets"]>;
        };
        "driver:get_beatmap_by_id": {
            params: [number, string?];
            result: ReturnType<IOsuDriver["get_beatmap_by_id"]>;
        };
        "driver:get_beatmapset": {
            params: [number, string?];
            result: ReturnType<IOsuDriver["get_beatmapset"]>;
        };
        "driver:get_missing_beatmaps": {
            params: [string | null, string?];
            result: ReturnType<IOsuDriver["get_missing_beatmaps"]>;
        };
        "driver:get_beatmap_files": {
            params: [string, string?];
            result: ReturnType<IOsuDriver["get_beatmap_files"]>;
        };
        "driver:search_beatmaps": {
            params: [IBeatmapFilter, string?];
            result: ReturnType<IOsuDriver["search_beatmaps"]>;
        };
        "driver:search_beatmapsets": {
            params: [IBeatmapSetFilter, string?];
            result: ReturnType<IOsuDriver["search_beatmapsets"]>;
        };
        "driver:export_beatmapset": {
            params: [number, string?];
            result: ReturnType<IOsuDriver["export_beatmapset"]>;
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
        // media
        "media:get": {
            params: string;
            result: GenericResult<ArrayBuffer>;
        };
        "media:get_buffer": {
            params: string;
            result: GenericResult<Uint8Array>;
        };
        // update
        "updater:update": {
            params: undefined;
            result: void;
        };
    };
    send: {
        "downloader:events": IDownloadEvent;
        "processor:events": IProcessorEvent;
        "export:update": IExportUpdate;
        "export:finish": IExportFinish;
        "updater:new": UpdateInfo;
        "updater:finish": GenericResult<string>;
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
