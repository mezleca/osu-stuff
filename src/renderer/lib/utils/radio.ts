import {
    ALL_BEATMAPS_KEY,
    BEATMAP_CARD_ELEMENT,
    type BeatmapCardElements,
    type ICollectionResult,
    type ISelectedBeatmap,
    type IBeatmapResult
} from "@shared/types";

import { url_to_media } from "./utils";

export const get_radio_card_elements = (selected_collection: string): BeatmapCardElements => {
    if (selected_collection == ALL_BEATMAPS_KEY) {
        return BEATMAP_CARD_ELEMENT.CONTEXT_MENU | BEATMAP_CARD_ELEMENT.EXTRA_ACTIONS;
    }

    return BEATMAP_CARD_ELEMENT.CONTEXT_MENU | BEATMAP_CARD_ELEMENT.CONTEXT_MENU_REMOVE | BEATMAP_CARD_ELEMENT.EXTRA_ACTIONS;
};

export const get_radio_collection_options = (collections: ICollectionResult[]) => {
    return [
        { label: "all beatmaps", value: ALL_BEATMAPS_KEY },
        ...collections.map((collection) => ({ label: collection.name, value: collection.name }))
    ];
};

export const get_radio_background_image = (beatmap: IBeatmapResult | null, enabled: boolean): string => {
    if (!enabled || !beatmap) {
        return "";
    }

    const local = beatmap.background ? url_to_media(beatmap.background) : "";
    const web = beatmap.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg` : "";

    return local != "" ? local : web;
};

export const push_previous_if_new = (previous: ISelectedBeatmap[], beatmap: ISelectedBeatmap): ISelectedBeatmap[] => {
    const last = previous[previous.length - 1];
    const already_last = !!last && last.id == beatmap.id && last.index == beatmap.index;

    if (already_last) {
        return previous;
    }

    return [...previous, beatmap];
};
