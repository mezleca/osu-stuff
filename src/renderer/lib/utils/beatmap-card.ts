import {
    BEATMAP_CARD_ELEMENT,
    has_flag,
    type BeatmapCardElements,
    type BeatmapCardMode,
    type BeatmapComponentState,
    type IBeatmapResult
} from "@shared/types";

export interface BeatmapCardFlags {
    show_context_menu: boolean;
    show_context_remove: boolean;
    show_status: boolean;
    show_bpm: boolean;
    show_star_rating: boolean;
    show_extra_actions: boolean;
    show_action_remove: boolean;
}

export const get_beatmap_card_flags = (elements: BeatmapCardElements): BeatmapCardFlags => ({
    show_context_menu: has_flag(elements, BEATMAP_CARD_ELEMENT.CONTEXT_MENU),
    show_context_remove: has_flag(elements, BEATMAP_CARD_ELEMENT.CONTEXT_MENU_REMOVE),
    show_status: has_flag(elements, BEATMAP_CARD_ELEMENT.STATUS),
    show_bpm: has_flag(elements, BEATMAP_CARD_ELEMENT.BPM_TEXT),
    show_star_rating: has_flag(elements, BEATMAP_CARD_ELEMENT.STAR_RATING_TEXT),
    show_extra_actions: has_flag(elements, BEATMAP_CARD_ELEMENT.EXTRA_ACTIONS),
    show_action_remove: has_flag(elements, BEATMAP_CARD_ELEMENT.ACTION_REMOVE)
});

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
