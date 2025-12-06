import type { IBeatmapResult, BeatmapSetResult } from "@shared/types";
import { get_image_url, string_is_valid } from "./utils";

const PLACEHOLDER_IMAGE = "@assets/images/fallback.png";

export const get_card_image_source = async (item: IBeatmapResult | BeatmapSetResult): Promise<string> => {
    if (!item) {
        return PLACEHOLDER_IMAGE;
    }

    // check if it is a beatmap
    if ("beatmapset_id" in item) {
        const beatmap = item as IBeatmapResult;

        if (beatmap.background) {
            const src = await get_image_url(beatmap.background);
            if (string_is_valid(src)) return src;
        }

        if (beatmap.beatmapset_id) {
            return `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`;
        }
    }

    // check if it is a beatmapset
    if ("online_id" in item) {
        const beatmapset = item as BeatmapSetResult;
        if (beatmapset.online_id) {
            return `https://assets.ppy.sh/beatmaps/${beatmapset.online_id}/covers/cover.jpg`;
        }
    }

    return PLACEHOLDER_IMAGE;
};
