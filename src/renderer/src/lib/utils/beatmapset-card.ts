import { BEATMAP_CARD_ELEMENT, type BeatmapCardElements, type BeatmapSetComponentState, type IBeatmapResult } from "@shared/types";
import { get_beatmap } from "./beatmaps";

export const BEATMAPSET_DIFFICULTY_CARD_ELEMENTS: BeatmapCardElements = BEATMAP_CARD_ELEMENT.CONTEXT_MENU;

export const get_visible_hashes = (state: BeatmapSetComponentState | null, filtered_hashes: string[]): string[] => {
    const beatmaps = state?.beatmapset?.beatmaps ?? [];

    if (filtered_hashes.length == 0) {
        return beatmaps;
    }

    return beatmaps.filter((hash) => filtered_hashes.includes(hash));
};

export const fetch_beatmaps_with_limit = async (hashes: string[], concurrency: number): Promise<IBeatmapResult[]> => {
    const results: IBeatmapResult[] = [];

    for (let i = 0; i < hashes.length; i += concurrency) {
        const batch = hashes.slice(i, i + concurrency);
        const batch_result = await Promise.all(batch.map((hash) => get_beatmap(hash)));

        for (const beatmap of batch_result) {
            if (beatmap) {
                results.push(beatmap);
            }
        }
    }

    return results;
};

export const sort_beatmaps_by_star_rating = (beatmaps: IBeatmapResult[]): IBeatmapResult[] => {
    return [...beatmaps].sort((left, right) => (left?.star_rating || 0) - (right?.star_rating || 0));
};

export const get_first_beatmap = (beatmaps: IBeatmapResult[]): IBeatmapResult | null => {
    return beatmaps[0] ?? null;
};
