import {
    BEATMAP_CARD_ELEMENT,
    has_flag,
    type BeatmapCardCallbacks,
    type BeatmapCardElements,
    type BeatmapCardMode,
    type BeatmapCardViewState,
    type BeatmapComponentState,
    type IBeatmapResult
} from "@shared/types";

export type BeatmapCardFlags = {
    show_context_menu: boolean;
    show_context_remove: boolean;
    show_status: boolean;
    show_bpm: boolean;
    show_star_rating: boolean;
    show_extra_actions: boolean;
    show_action_remove: boolean;
};

export const EMPTY_BEATMAP_CARD_VIEW_STATE: BeatmapCardViewState = {
    selected: false,
    highlighted: false,
    centered: false,
    height: 100,
    image_loaded: false,
    background: "",
    hash: "",
    beatmap: null,
    has_map: false,
    show_status: false,
    show_bpm: false,
    show_star_rating: false,
    show_extra_actions: false,
    show_action_remove: false,
    star_rating: 0,
    formatted_star_rating: "0.0"
};

export const EMPTY_BEATMAP_CARD_CALLBACKS: BeatmapCardCallbacks = {
    on_click: null,
    on_contextmenu: null,
    on_remove: null,
    on_download: null
};

export const get_beatmap_card_flags = (elements: BeatmapCardElements): BeatmapCardFlags => {
    return {
        show_context_menu: has_flag(elements, BEATMAP_CARD_ELEMENT.CONTEXT_MENU),
        show_context_remove: has_flag(elements, BEATMAP_CARD_ELEMENT.CONTEXT_MENU_REMOVE),
        show_status: has_flag(elements, BEATMAP_CARD_ELEMENT.STATUS),
        show_bpm: has_flag(elements, BEATMAP_CARD_ELEMENT.BPM_TEXT),
        show_star_rating: has_flag(elements, BEATMAP_CARD_ELEMENT.STAR_RATING_TEXT),
        show_extra_actions: has_flag(elements, BEATMAP_CARD_ELEMENT.EXTRA_ACTIONS),
        show_action_remove: has_flag(elements, BEATMAP_CARD_ELEMENT.ACTION_REMOVE)
    };
};

export const get_display_beatmap = (
    mode: BeatmapCardMode,
    beatmap: IBeatmapResult | null,
    state: BeatmapComponentState | null
): IBeatmapResult | null => {
    if (mode == "minimal" && beatmap) {
        return beatmap;
    }

    return state?.beatmap ?? beatmap;
};

export const get_formatted_star_rating = (beatmap: IBeatmapResult | null): string => {
    const rating = beatmap?.star_rating ?? 0;
    return Number.isFinite(rating) ? rating.toFixed(2) : "0.0";
};

type CreateBeatmapCardViewStateArgs = {
    selected: boolean;
    highlighted: boolean;
    centered: boolean;
    height: number;
    image_loaded: boolean;
    hash: string;
    beatmap: IBeatmapResult | null;
    state: BeatmapComponentState | null;
    flags: BeatmapCardFlags;
};

export const create_beatmap_card_view_state = (args: CreateBeatmapCardViewStateArgs): BeatmapCardViewState => {
    const star_rating = args.beatmap?.star_rating ?? 0;

    return {
        selected: args.selected,
        highlighted: args.highlighted,
        centered: args.centered,
        height: args.height,
        image_loaded: args.image_loaded,
        background: args.state?.background ?? "",
        hash: args.hash,
        beatmap: args.beatmap,
        has_map: !!args.state?.beatmap && args.state.beatmap.temp == false,
        show_status: args.flags.show_status,
        show_bpm: args.flags.show_bpm,
        show_star_rating: args.flags.show_star_rating,
        show_extra_actions: args.flags.show_extra_actions,
        show_action_remove: args.flags.show_action_remove,
        star_rating,
        formatted_star_rating: get_formatted_star_rating(args.beatmap)
    };
};
