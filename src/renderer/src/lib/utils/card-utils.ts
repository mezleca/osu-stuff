import type { IBeatmapResult, BeatmapSetResult } from "@shared/types";
import { get_image_url, string_is_valid } from "./utils";
import { config } from "../store/config";

const PLACEHOLDER_IMAGE = "@assets/images/fallback.png";

export const get_card_image_source = async (item: IBeatmapResult | BeatmapSetResult): Promise<string> => {
    // use the placeholder image on invalid beatmap
    if (!item) {
        return PLACEHOLDER_IMAGE;
    }

    // check if it is a beatmap
    if ("beatmapset_id" in item) {
        const beatmap = item as IBeatmapResult;

        // always check if we actually want to have local images
        if (config.get("local_images") === false) {
            return `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`;
        }

        if (beatmap.background) {
            const src = await get_image_url(beatmap.background);
            if (string_is_valid(src)) return src;
        }

        // fallback to web asset
        return `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`;
    }

    // check if it is a beatmapset
    if ("online_id" in item) {
        const beatmapset = item as BeatmapSetResult;

        // fallback to asset
        if (beatmapset.online_id) {
            return `https://assets.ppy.sh/beatmaps/${beatmapset.online_id}/covers/cover.jpg`;
        }
    }

    return PLACEHOLDER_IMAGE;
};
