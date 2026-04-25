import type { ICollectionResult, IBeatmapResult, BeatmapSetResult } from "./osu";

export interface CarouselConfig {
    SCALE_THRESHOLD_NEAR: number;
    SCALE_THRESHOLD_FAR: number;
    FADE_RANGE: number;
    SCALE_FULL: number;
    SCALE_MINIMUM: number;
    HOVER_MARGIN: number;
    PUSH_RANGE: number;
    PUSH_STRENGTH: number;
}

export interface ScrollAnimationState {
    animation_id: number | null;
    start_time: number;
    duration: number;
    start_scroll: number;
    target_scroll: number;
}

export interface CarouselTransform {
    scale: number;
    x_offset: number;
    y_offset: number;
}

export interface MousePoint {
    x: number;
    y: number;
}

export interface TestItem {
    id: string;
    text: string;
    data?: TestItem[];
}

export interface IOsuCollectorResult {
    name: string;
    beatmaps: IBeatmapResult[];
    checksums: string[];
}

export interface Handler {
    id: number;
    callback: () => void;
}

export interface IAudioState {
    beatmap: IBeatmapResult | null;
    audio: HTMLAudioElement | null;
    id: string | null;
    playing: boolean;
    ended: boolean;
    volume: number;
    progress: string;
    duration: string;
    progress_bar_width: number;
    is_loading: boolean;
}

export type AudioDirection = -1 | 0 | 1;

export interface IAudioCallbacks {
    get_next_id: (direction: number) => Promise<string | null>;
    get_beatmap: (id: string) => Promise<IBeatmapResult | undefined>;
}

export interface ISelectedBeatmap {
    id: string | number;
    index: number;
}

export interface BeatmapComponentState {
    beatmap: IBeatmapResult | null;
    loaded: boolean;
    loading: boolean;
    background: string;
}

export interface BeatmapCardViewState {
    selected: boolean;
    highlighted: boolean;
    centered: boolean;
    height: number;
    image_loaded: boolean;
    background: string;
    hash: string;
    beatmap: IBeatmapResult | null;
    has_map: boolean;
    show_status: boolean;
    show_bpm: boolean;
    show_star_rating: boolean;
    show_extra_actions: boolean;
    show_action_remove: boolean;
    star_rating: number;
    formatted_star_rating: string;
}

export interface BeatmapCardCallbacks {
    on_click: ((event: MouseEvent) => void) | null;
    on_contextmenu: ((event: MouseEvent) => void) | null;
    on_remove: ((checksum: string) => void) | null;
    on_download: ((checksum: string) => void) | null;
}

export interface VirtualListRef {
    focus_selected: (force?: boolean) => void;
    scroll_to_item: (index: number) => Promise<void>;
}

export interface BeatmapListRef {
    focus_selected: (force?: boolean) => void;
    get_total: () => number;
}

export interface BeatmapSetComponentState {
    beatmapset: BeatmapSetResult | null;
    beatmaps: IBeatmapResult[];
    failed_beatmaps: Set<string>;
    loaded: boolean;
    loading: boolean;
    background: string;
}

export interface INotification {
    id: string;
    type: "info" | "error" | "success" | "warning" | "confirm";
    text: string;
    persist: boolean;
    duration: number;
    on_click?: () => void | Promise<void>;
    on_before_close?: () => void;
    actions?: INotificationAction[];
}

export interface INotificationAction {
    id: string;
    label: string;
    on_click?: () => void | Promise<void>;
    close_on_click?: boolean;
}

export interface UpdateProgress {
    available: boolean;
    updating: boolean;
    checking: boolean;
    installing: boolean;
    manual_update_required: boolean;
}

export interface IApiBeatmapSetMetadata {
    title: string;
    artist: string;
    creator: string;
    source: string;
    tags: string;
}

export interface ICollectionWithEdit extends ICollectionResult {
    edit: boolean;
}

export interface ISelectedCollection {
    name: string;
    beatmaps: string[];
}

export interface IMissingCache {
    count: number;
    last_checked_modified: number;
}

export type BeatmapUpdateReason = "filters" | "remove" | "manual" | "unknown";
export const BEATMAP_CARD_ELEMENT = {
    STATUS: 1 << 0,
    STAR_RATING_TEXT: 1 << 1,
    BPM_TEXT: 1 << 2,
    CONTEXT_MENU: 1 << 3,
    CONTEXT_MENU_REMOVE: 1 << 4,
    EXTRA_ACTIONS: 1 << 5,
    ACTION_REMOVE: 1 << 6
} as const;

export type BeatmapCardElementFlag = (typeof BEATMAP_CARD_ELEMENT)[keyof typeof BEATMAP_CARD_ELEMENT];
export type BeatmapCardElements = number;

export type BeatmapCardMode = "card" | "minimal" | "radio";
