/* USEFUL CONSTANTS */

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
};

export enum BeatmapStatus {
    All = -1,
    Unknown = 0,
    Unsubmitted = 1,
    Pending = 2,
    Unused = 3,
    Ranked = 4,
    Approved = 5,
    Qualified = 6,
    Loved = 7
};

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
};

export enum GameMode {
    Osu = 0,
    Taiko = 1,
    Catch = 2,
    Mania = 3
};

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
};

export interface IStableBeatmap {
    entry: number;
    artist: string;
    artist_unicode: string;
    title: string;
    title_unicode: string;
    mapper: string;
    difficulty: string;
    audio_file_name: string;
    md5: string;
    file: string;
    status: BeatmapStatus;
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
    file_path: string;
    temp: boolean;
};

export interface ILegacyDatabase {
    version: number;
    folders: number;
    account_unlocked: boolean;
    last_unlocked_time: bigint;
    player_name: string;
    beatmaps_count: number;
    beatmaps: Map<string, IStableBeatmap>;
};

export interface IStableCollection {
    bpm_max?: number;
    sr_max?: number;
    name: string;
    maps: Set<string>;
};

export interface ILegacyCollectionDatabase {
    version: number;
    length: number;
    collections: IStableCollection[];
};

/* OSU DRIVER RELATED STUFF */

export type StarRatingFilter = [number, number];

export interface IBeatmapFilter {
    // general
    query: string;
    sort: keyof IBeatmapResult;
    status?: string;
    show_invalid: boolean;
    difficulty_range?: StarRatingFilter;

    // make sure we keep 1 diff per beatmap (unless its a set with different music files)
    unique: boolean;

    // will be used if available on filter
    collection?: string;

    // web only
    language?: string;
    mode?: any;
};

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
    local: boolean;
    temp: boolean;
    unique_id?: string;
    duration?: number;
    image_path?: string;
    audio_path?: string;
    last_played?: Date;
};

export interface IBeatmapSetResultMetadata {
    artist: string;
    title: string;
    creator: string;
};

export interface BeatmapSetResult {
    online_id: number;
    metadata: IBeatmapSetResultMetadata;
    beatmaps: IBeatmapResult[];
};

export interface ICollectionResult {
    name: string;
    beatmaps: string[];
};

export interface IProcessorInput {
    md5: string;
    unique_id: string;
    file_path: string;
    audio_path?: string;
    image_path?: string;
};

export interface IProcesedBeatmap {
    md5: string;
    unique_id: string;
    audio_path: string;
    image_path: string;
    duration: number;
};

export interface IProcessedData {
    audio_path: string;
    image_path: string;
    duration: number;
};

export type BeatmapFile = {
    name: string;
    location: string;
};

export interface IAddCollectionParams {
    name: string; 
    beatmaps: string[];
};

export interface IUpdateCollectionParams {
    collections: ICollectionResult[];
};

export interface IExportCollectionsParams {
    collections: ICollectionResult[];
    type: string;
};

export interface IGetBeatmapByMd5Params {
    md5: string;
};

export interface IGetBeatmapByIdParams {
    id: number;
};

export interface IGetBeatmapsetParams {
    set_id: number;
};

export interface IGetBeatmapsetFilesParams {
    id: number;
};

export interface IFetchBeatmapsParams {
    checksums: string[];
};

export interface IAddBeatmapParams {
    beatmap: IBeatmapResult;
};

export interface IDeleteCollectionParams {
    name: string;
};

export interface IGetCollectionParams {
    name: string;
};

export interface IOsuDriver {
    initialize(): Promise<void>;
    get_player_name(): string;
    add_collection(params: IAddCollectionParams): boolean;
    delete_collection(params: IDeleteCollectionParams): boolean;
    get_collection(params: IGetCollectionParams): ICollectionResult | undefined;
    get_collections(): ICollectionResult[];
    update_collection(params: IUpdateCollectionParams): boolean;
    export_collections(params: IExportCollectionsParams): Promise<boolean>;
    add_beatmap(params: IAddBeatmapParams): boolean;
    get_beatmap_by_md5(params: IGetBeatmapByMd5Params): Promise<IBeatmapResult | undefined>;
    get_beatmap_by_id(params: IGetBeatmapByIdParams): Promise<IBeatmapResult | undefined>;
    get_beatmapset(params: IGetBeatmapsetParams): Promise<BeatmapSetResult | undefined>;
    search_beatmaps(params: IBeatmapFilter): Promise<string[]>;
    get_all_beatmaps(): Promise<string[]>;
    get_beatmapset_files(params: IGetBeatmapsetFilesParams): Promise<BeatmapFile[]>;
    fetch_beatmaps(params: IFetchBeatmapsParams): Promise<IBeatmapResult[]>;
    dispose(): Promise<void>;
};

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
};

export interface IOSDBCollection {
    name: string;
    online_id?: number;
    beatmaps: IOSDBBeatmap[];
    hash_only_beatmaps: string[];
};

export interface IOSDBData {
    save_date: bigint;
    last_editor: string;
    count: number;
    collections: IOSDBCollection[];
};

/* BEATMAP DOWNLOADER */

export interface IDownloadProgress {
    current: number;
    size: number;
    failed: number;
};

export interface IDownloadData {
    progress: IDownloadProgress;
    finished: boolean;
    processing: boolean;
    paused: boolean;
};

export interface IDownloadUpdate {
    queue: IDownloadData[];
};

export interface ExportBeatmapParams {
    md5: string;
};

export interface ExportBeatmapsParams {
    md5_list: string[];
};

export interface ExportCollectionParams {
    collection_names: string[];
};

export interface IExportUpdatePayload {
    status: "start" | "done" | "exists" | "linked" | "missing" | "error" | "complete";
    md5?: string;
    collection?: string;
    total?: number;
    beatmapset_id?: string;
    path?: string;
    reason?: string;
    written?: number;
};

export interface ExportResult {
    success: boolean;
    written: string[];
    reason: string;
};

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

// pretty sure i will only use this on the binary reader
export const stable_byte_to_status = (byte: number): BeatmapStatus => {
    switch (byte) {
        case -1:
            return BeatmapStatus.All;
        case 0:
            return BeatmapStatus.Unknown;
        case 1:
            return BeatmapStatus.Unsubmitted;
        case 2:
            return BeatmapStatus.Pending;
        case 3:
            return BeatmapStatus.Unused;
        case 4:
            return BeatmapStatus.Ranked;
        case 5:
            return BeatmapStatus.Approved;
        case 6:
            return BeatmapStatus.Qualified;
        case 7:
            return BeatmapStatus.Loved;
        default:
            return BeatmapStatus.Unknown;
    }
};

export const beatmap_status_to_code = (status: string): BeatmapStatus => {
    switch (status.toLowerCase()) {
        case "all":
            return BeatmapStatus.All;
        case "unsubmitted":
            return BeatmapStatus.Unsubmitted;
        case "unused":
            return BeatmapStatus.Unused;
        case "ranked":
            return BeatmapStatus.Ranked;
        case "approved":
            return BeatmapStatus.Approved;
        case "qualified":
            return BeatmapStatus.Qualified;
        case "loved":
            return BeatmapStatus.Loved;
        // stable classifies these 3 as "pending..."
        case "pending":
        case "graveyard":
        case "wip":
            return BeatmapStatus.Pending;
        default:
            return BeatmapStatus.Unknown;
    }
};

export const beatmap_status_from_code = (status: BeatmapStatus) => {
    switch (status) {
        case BeatmapStatus.All:
            return "All";
        case BeatmapStatus.Unsubmitted:
            return "Unsubmitted";
        case BeatmapStatus.Pending:
            return "Pending";
        case BeatmapStatus.Unused:
            return "Unused";
        case BeatmapStatus.Ranked:
            return "Ranked";
        case BeatmapStatus.Approved:
            return "Approved";
        case BeatmapStatus.Qualified:
            return "Qualified";
        case BeatmapStatus.Loved:
            return "Loved";
    }

    return "Unknown";
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

export const stable_status_to_enum = (status: number): BeatmapStatus => {
    switch (status) {
        case -1:
            return BeatmapStatus.All;
        case 0:
            return BeatmapStatus.Unknown;
        case 1:
            return BeatmapStatus.Unsubmitted;
        case 2:
            return BeatmapStatus.Pending; // graveyard/wip/pending todos mapeiam pra pending
        case 3:
            return BeatmapStatus.Unused;
        case 4:
            return BeatmapStatus.Ranked;
        case 5:
            return BeatmapStatus.Approved;
        case 6:
            return BeatmapStatus.Qualified;
        case 7:
            return BeatmapStatus.Loved;
        default:
            return BeatmapStatus.Unknown;
    }
};

export const enum_to_stable_status = (status: BeatmapStatus): number => {
    switch (status) {
        case BeatmapStatus.All:
            return STABLE_STATUS.ALL;
        case BeatmapStatus.Unknown:
            return STABLE_STATUS.UNKNOWN;
        case BeatmapStatus.Unsubmitted:
            return STABLE_STATUS.UNSUBMITTED;
        case BeatmapStatus.Pending:
            return STABLE_STATUS.PENDING;
        case BeatmapStatus.Unused:
            return STABLE_STATUS.UNUSED;
        case BeatmapStatus.Ranked:
            return STABLE_STATUS.RANKED;
        case BeatmapStatus.Approved:
            return STABLE_STATUS.APPROVED;
        case BeatmapStatus.Qualified:
            return STABLE_STATUS.QUALIFIED;
        case BeatmapStatus.Loved:
            return STABLE_STATUS.LOVED;
        default:
            return STABLE_STATUS.UNKNOWN;
    }
};
