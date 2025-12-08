/* USEFUL CONSTANTS */

import { OsuInput } from "@rel-packages/osu-beatmap-parser";
import { Beatmapset } from "osu-api-extended/dist/types/v2/beatmaps_packs_details";

export const LEGACY_DATABASE_VERSION: number = 20251102;
export const LAZER_DATABASE_VERSION: number = 51;

/* ENUMERATORS */

export enum Permissions {
    None = 0,
    Normal = 1,
    Moderator = 2,
    Supporter = 4,
    Friend = 8,
    Peppy = 16,
    WorldCupStaff = 32
}

export enum StableBeatmapStatus {
    All = -1,
    Unknown = 0,
    Unsubmitted = 1,
    Pending = 2,
    Unused = 3,
    Ranked = 4,
    Approved = 5,
    Qualified = 6,
    Loved = 7
}

export enum LazerBeatmapStatus {
    LocacllyModified = -4,
    Unsubmitted = -3,
    Graveyard = -2,
    Wip = -1,
    Pending = 0,
    Ranked = 1,
    Approved = 2,
    Qualified = 3,
    Loved = 4
}

export enum OsdbVersion {
    O_DM = 1,
    O_DM2 = 2,
    O_DM3 = 3,
    O_DM4 = 4,
    O_DM5 = 5,
    O_DM6 = 6,
    O_DM7 = 7,
    O_DM8 = 8,
    O_DM7_MIN = 1007,
    O_DM8_MIN = 1008
}

export enum GameMode {
    Osu = 0,
    Taiko = 1,
    Catch = 2,
    Mania = 3
}

export const STABLE_STATUS = {
    ALL: -1,
    UNKNOWN: 0,
    UNSUBMITTED: 1,
    GRAVEYARD: 2,
    WIP: 2,
    PENDING: 2,
    UNUSED: 3,
    RANKED: 4,
    APPROVED: 5,
    QUALIFIED: 6,
    LOVED: 7
} as const;

/* OSU STABLE SCHEMA */

export interface IStableTimingPoint {
    beat_length: number;
    offset: number;
    inherited: boolean;
}

export interface IStableBeatmap {
    entry: number;
    artist: string;
    artist_unicode: string;
    title: string;
    title_unicode: string;
    creator: string;
    difficulty: string;
    audio_file_name: string;
    md5: string;
    file: string;
    status: StableBeatmapStatus;
    hitcircle: number;
    sliders: number;
    spinners: number;
    last_modification: bigint;
    bpm: number;
    ar: number;
    cs: number;
    hp: number;
    od: number;
    slider_velocity: number;
    star_rating: number[];
    timing_points: IStableTimingPoint[];
    drain_time: number;
    length: number;
    audio_preview: number;
    difficulty_id: number;
    beatmapset_id: number;
    thread_id: number;
    grade_standard: number;
    grade_taiko: number;
    grade_ctb: number;
    grade_mania: number;
    local_offset: number;
    stack_leniency: number;
    mode: number;
    source: string;
    tags: string;
    online_offset: number;
    font: string;
    unplayed: boolean;
    last_played: bigint;
    is_osz2: boolean;
    folder_name: string;
    last_checked: bigint;
    ignore_sounds: boolean;
    ignore_skin: boolean;
    disable_storyboard: boolean;
    disable_video: boolean;
    visual_override: boolean;
    unknown: number;
    mania_scroll_speed: number;
    unique_id: string;
    audio_path: string;
    file_path: string;
    image_path: string;
    temp: boolean;
}

export interface IStableBeatmapset {
    title: string;
    artist: string;
    creator: string;
    online_id: number;
    // NOTE: we dont need to store the beatmap object two times (LegacyDatabase should store it)
    beatmaps: Set<string>;
}

export interface ILegacyDatabase {
    version: number;
    folders: number;
    account_unlocked: boolean;
    last_unlocked_time: bigint;
    player_name: string;
    beatmaps_count: number;
    beatmaps: Map<string, IStableBeatmap>;
    beatmapsets: Map<number, IStableBeatmapset>;
}

/* OSU DRIVER RELATED STUFF */

export type StarRatingFilter = [number, number];

export interface IBeatmapFilter {
    // general
    query: string;
    sort: keyof IBeatmapResult;
    status?: string;
    difficulty_range?: StarRatingFilter;

    // make sure we keep 1 diff per beatmap (unless its a set with different music files)
    unique: boolean;

    // will be used if available on filter
    collection?: string;
}

export interface IBeatmapSetFilter {
    query: string;
    sort: keyof BeatmapSetResult["metadata"];
    status?: string;
    difficulty_range?: StarRatingFilter;
}

export interface IBeatmapResult {
    md5: string;
    online_id: number;
    beatmapset_id: number;
    title: string;
    artist: string;
    creator: string;
    difficulty: string;
    source?: string;
    tags: string[] | string;
    ar: number;
    cs: number;
    hp: number;
    od: number;
    star_rating: number;
    bpm: number;
    length: number;
    status: string;
    mode: string;
    temp: boolean;
    last_modified: string;

    // processor
    unique_id?: string;
    background: string;
    duration?: number;
    audio?: string;
}

export interface IMinimalBeatmapResult {
    beatmap_id?: number;
    beatmapset_id?: number;
    difficulty_rating?: number;
    status?: string;
    md5?: string;
    version?: string;
    artist?: string;
    title?: string;
    creator?: string;
    _raw?: any;
}

export interface IBeatmapSetResultMetadata {
    artist: string;
    title: string;
    creator: string;
}

export interface BeatmapSetResult {
    online_id: number;
    metadata: IBeatmapSetResultMetadata;
    beatmaps: string[];
    temp: boolean;
}

export interface ICollectionResult {
    name: string;
    beatmaps: string[];
    bpm_min?: 0;
    bpm_max?: 0;
}

export type ExtractType = "duration" | "background" | "video";

export interface ProcessorInput extends OsuInput {
    last_modified?: string;
}

export interface ExtractedData {
    duration?: number;
    background?: string;
    audio?: string;
    video?: string;
}

export interface ProcessorResult {
    md5: string;
    last_modified: string;
    duration?: number;
    background?: string;
    video?: string;
}

export type ProcessorEvent = "start" | "finish" | "update";

export interface IProcessorEventData {
    status?: string;
    large_text?: string;
    small_text?: string;
    index?: number;
    length?: number;
}

export interface IProcessorEvent {
    type: ProcessorEvent;
    data?: IProcessorEventData;
}

// TODO: video :)
export interface BeatmapRow {
    md5: string;
    last_modified: string;
    duration: number;
    background: string;
    audio: string;
    video: string;
}

export type BeatmapFile = {
    name: string;
    location: string;
};

export interface ISearchResponse {
    beatmaps: IFilteredBeatmap[];
    invalid: string[];
}

export interface ISearchSetResponse {
    beatmapsets: IFilteredBeatmapSet[];
    invalid: number[];
}

export interface IFilteredBeatmapSet {
    id: number;
    beatmaps: string[];
}

export interface IFilteredBeatmap {
    md5: string;
}

// TODO: get_beatmap_by<T>
export interface IOsuDriver {
    initialize(force: boolean): Promise<boolean>;
    get_player_name(): string;
    add_collection(name: string, beatmaps: string[]): boolean;
    rename_collection(old_name: string, new_name: string): boolean;
    delete_collection(name: string): boolean;
    delete_beatmap(options: { md5: string; collection?: string }): Promise<boolean>;
    get_collection(name: string): ICollectionResult | undefined;
    get_collections(): ICollectionResult[];
    update_collection(): boolean;
    export_collections(collections: ICollectionResult[], type: string): Promise<boolean>;
    export_beatmapset(id: number): Promise<boolean>;
    add_beatmap(beatmap: IBeatmapResult): boolean;
    add_beatmaps_to_collection(collection_name: string, hashes: string[]): boolean;
    has_beatmap(md5: string): boolean;
    has_beatmapset(id: number): boolean;
    get_beatmap_by_md5(md5: string): Promise<IBeatmapResult | undefined>;
    get_beatmap_by_id(id: number): Promise<IBeatmapResult | undefined>;
    get_beatmapset(set_id: number): Promise<BeatmapSetResult | undefined>;
    get_missing_beatmaps(name: string | null): Promise<string[]>;
    search_beatmaps(params: IBeatmapFilter): Promise<ISearchResponse>;
    search_beatmapsets(params: IBeatmapSetFilter): Promise<ISearchSetResponse>;
    get_beatmaps(): Promise<IFilteredBeatmap[]>;
    get_beatmapsets(): Promise<IFilteredBeatmapSet[]>;
    get_beatmapset_files(id: number): Promise<BeatmapFile[]>;
    fetch_beatmaps(checksums: string[]): Promise<{ beatmaps: IBeatmapResult[]; invalid: string[] }>;
    fetch_beatmapsets(ids: number[]): Promise<{ beatmaps: BeatmapSetResult[]; invalid: number[] }>;
    dispose(): Promise<void>;
}

/* OTHER WEB APIS */

export interface IOsuCollectorUser {
    id: number;
    username: string;
    rank?: number;
}

export interface IOsuCollectorBeatmapCovers {
    card: string | null;
}

export interface IOsuCollectorBeatmapSet {
    id: number | null;
    artist: string | null;
    title: string | null;
    creator: string | null;
    covers: IOsuCollectorBeatmapCovers;
}

export interface IOsuCollectorBeatmap {
    id: number;
    checksum: string | null;
    difficulty_rating: number | null;
    accuracy: number | null;
    version: string | null;
    mode: string | null;
    cs: number | null;
    ar: number | null;
    hit_length: number | null;
    bpm: number | null;
    status: string | null;
    beatmapset: IOsuCollectorBeatmapSet;
}

export interface IOsuCollectorModCategory {
    mod: string;
    maps: IOsuCollectorBeatmap[];
}

export interface IOsuCollectorRound {
    mods: IOsuCollectorModCategory[];
    round: string;
}

export interface IOsuCollectorTimestamp {
    _seconds: number;
    _nanoseconds: number;
}

export interface IOsuCollectorTournament {
    id: number;
    name: string;
    link: string;
    banner: string;
    downloadUrl: string;
    description: string;
    uploader: IOsuCollectorUser;
    organizers: IOsuCollectorUser[];
    organizerIds: number[];
    dateUploaded: IOsuCollectorTimestamp;
    dateModified: IOsuCollectorTimestamp;
    rounds: IOsuCollectorRound[];
}

export interface IOsuCollectorCollectionBeatmap {
    id: number;
    beatmapset_id: number;
    checksum: string;
    version: string;
    mode: string;
    difficulty_rating: number;
    accuracy: number;
    drain: number;
    bpm: number;
    cs: number;
    ar: number;
    hit_length: number;
    status: string;
}

export interface IOsuCollectorCollectionBeatmapSet {
    id: number;
    creator: string;
    artist: string;
    artist_unicode: string;
    title: string;
    title_unicode: string;
    bpm: number;
    cover: string;
    submitted_date: string;
    last_updated: string;
    ranked_date: string | null;
    favourite_count: number | null;
    status: string | null;
}

export interface IOsuCollectorCollection {
    beatmaps: IOsuCollectorCollectionBeatmap[];
    beatmapsets: IOsuCollectorCollectionBeatmapSet[];
}

export type IExtendedBeatmapSet = Beatmapset;

/* OSDB */

export interface IOSDBBeatmap {
    difficulty_id: number;
    beatmapset_id: number;
    artist?: string;
    title?: string;
    diff_name?: string;
    md5: string;
    user_comment?: string;
    mode?: number;
    difficulty_rating?: number;
}

export interface IOSDBCollection {
    name: string;
    online_id?: number;
    beatmaps: IOSDBBeatmap[];
    hash_only_beatmaps: string[];
}

export interface IOSDBData {
    save_date: bigint;
    last_editor: string;
    count: number;
    collections: IOSDBCollection[];
}

/* ENUMERATOR HELPERS */

export const gamemode_to_code = (mode: string) => {
    switch (mode.toLowerCase()) {
        case "osu":
            return GameMode.Osu;
        case "taiko":
            return GameMode.Taiko;
        case "catch":
            return GameMode.Catch;
        case "mania":
            return GameMode.Mania;
    }

    return 0; // defaults to osu
};

export const gamemode_from_code = (mode: GameMode) => {
    switch (mode) {
        case GameMode.Osu:
            return "Osu";
        case GameMode.Taiko:
            return "Taiko";
        case GameMode.Catch:
            return "Catch";
        case GameMode.Mania:
            return "Mania";
    }
};

export const stable_status_to_code = (status: string): StableBeatmapStatus => {
    switch (status.toLowerCase()) {
        case "all":
            return StableBeatmapStatus.All;
        case "unsubmitted":
            return StableBeatmapStatus.Unsubmitted;
        case "unused":
            return StableBeatmapStatus.Unused;
        case "ranked":
            return StableBeatmapStatus.Ranked;
        case "approved":
            return StableBeatmapStatus.Approved;
        case "qualified":
            return StableBeatmapStatus.Qualified;
        case "loved":
            return StableBeatmapStatus.Loved;
        // stable classifies these 3 as "pending..."
        case "pending":
        case "graveyard":
        case "wip":
            return StableBeatmapStatus.Pending;
        default:
            return StableBeatmapStatus.Unknown;
    }
};

export const stable_status_from_code = (status: StableBeatmapStatus) => {
    switch (status) {
        case StableBeatmapStatus.All:
            return "All";
        case StableBeatmapStatus.Unsubmitted:
            return "Unsubmitted";
        case StableBeatmapStatus.Pending:
            return "Pending";
        case StableBeatmapStatus.Unused:
            return "Unused";
        case StableBeatmapStatus.Ranked:
            return "Ranked";
        case StableBeatmapStatus.Approved:
            return "Approved";
        case StableBeatmapStatus.Qualified:
            return "Qualified";
        case StableBeatmapStatus.Loved:
            return "Loved";
    }

    return "Unknown";
};

export const lazer_status_to_code = (status: string): LazerBeatmapStatus => {
    switch (status.toLowerCase()) {
        case "locally modified":
            return LazerBeatmapStatus.LocacllyModified;
        case "not submitted":
        case "unsubmitted":
            return LazerBeatmapStatus.Unsubmitted;
        case "pending":
        case "graveyard":
        case "wip":
            return LazerBeatmapStatus.Pending;
        case "ranked":
            return LazerBeatmapStatus.Ranked;
        case "approved":
            return LazerBeatmapStatus.Approved;
        case "qualified":
            return LazerBeatmapStatus.Qualified;
        case "loved":
            return LazerBeatmapStatus.Loved;
        default:
            return LazerBeatmapStatus.Unsubmitted;
    }
};

export const lazer_status_from_code = (status: LazerBeatmapStatus) => {
    switch (status) {
        case LazerBeatmapStatus.LocacllyModified:
            return "locally modified";
        case LazerBeatmapStatus.Unsubmitted:
            return "not submitted";
        case LazerBeatmapStatus.Pending:
            return "pending";
        case LazerBeatmapStatus.Ranked:
            return "ranked";
        case LazerBeatmapStatus.Approved:
            return "approved";
        case LazerBeatmapStatus.Qualified:
            return "qualified";
        case LazerBeatmapStatus.Loved:
            return "loved";
    }
    return "notsubmitted";
};

export const osdb_version_to_code = (version: string) => {
    switch (version) {
        case "o!dm":
            return OsdbVersion.O_DM;
        case "o!dm2":
            return OsdbVersion.O_DM2;
        case "o!dm3":
            return OsdbVersion.O_DM3;
        case "o!dm4":
            return OsdbVersion.O_DM4;
        case "o!dm5":
            return OsdbVersion.O_DM5;
        case "o!dm6":
            return OsdbVersion.O_DM6;
        case "o!dm7":
            return OsdbVersion.O_DM7;
        case "o!dm8":
            return OsdbVersion.O_DM8;
        case "o!dm7min":
            return OsdbVersion.O_DM7_MIN;
        case "o!dm8min":
            return OsdbVersion.O_DM8_MIN;
    }
    return OsdbVersion.O_DM;
};

export const osdb_version_from_code = (version: OsdbVersion) => {
    switch (version) {
        case OsdbVersion.O_DM:
            return "o!dm";
        case OsdbVersion.O_DM2:
            return "o!dm2";
        case OsdbVersion.O_DM3:
            return "o!dm3";
        case OsdbVersion.O_DM4:
            return "o!dm4";
        case OsdbVersion.O_DM5:
            return "o!dm5";
        case OsdbVersion.O_DM6:
            return "o!dm6";
        case OsdbVersion.O_DM7:
            return "o!dm7";
        case OsdbVersion.O_DM8:
            return "o!dm8";
        case OsdbVersion.O_DM7_MIN:
            return "o!dm7min";
        case OsdbVersion.O_DM8_MIN:
            return "o!dm8min";
    }
};

// aka stable status code to lazer status code...
export const stable_status_to_enum = (status: StableBeatmapStatus): LazerBeatmapStatus => {
    switch (status) {
        case StableBeatmapStatus.All:
        case StableBeatmapStatus.Unknown:
            return LazerBeatmapStatus.Unsubmitted; // idk vro
        case StableBeatmapStatus.Unsubmitted:
            return LazerBeatmapStatus.Unsubmitted;
        case StableBeatmapStatus.Pending:
        case StableBeatmapStatus.Unused: // the fuck is unused lol
            return LazerBeatmapStatus.Pending;
        case StableBeatmapStatus.Ranked:
            return LazerBeatmapStatus.Ranked;
        case StableBeatmapStatus.Approved:
            return LazerBeatmapStatus.Approved;
        case StableBeatmapStatus.Qualified:
            return LazerBeatmapStatus.Qualified;
        case StableBeatmapStatus.Loved:
            return LazerBeatmapStatus.Loved;
        default:
            return LazerBeatmapStatus.Unsubmitted;
    }
};

// aka lazer status code to stable status code
export const enum_to_stable_status = (status: LazerBeatmapStatus): number => {
    switch (status) {
        case LazerBeatmapStatus.LocacllyModified:
            return StableBeatmapStatus.Pending;
        case LazerBeatmapStatus.Unsubmitted:
            return StableBeatmapStatus.Unsubmitted;
        case LazerBeatmapStatus.Graveyard:
        case LazerBeatmapStatus.Wip:
        case LazerBeatmapStatus.Pending:
            return StableBeatmapStatus.Pending;
        case LazerBeatmapStatus.Ranked:
            return StableBeatmapStatus.Ranked;
        case LazerBeatmapStatus.Approved:
            return StableBeatmapStatus.Approved;
        case LazerBeatmapStatus.Qualified:
            return StableBeatmapStatus.Qualified;
        case LazerBeatmapStatus.Loved:
            return StableBeatmapStatus.Loved;
        default:
            return StableBeatmapStatus.Unsubmitted;
    }
};

export enum DriverActionType {
    Add = 0,
    Delete = 1,
    Rename = 2
}

export interface ICollectionAction {
    type: DriverActionType;
    name: string;
    new_name?: string;
    beatmaps?: string[];
}

export interface ICollectionBeatmapAction {
    type: DriverActionType;
    collection: string;
    md5: string;
}

export type DriverAction = ICollectionAction | ICollectionBeatmapAction;
