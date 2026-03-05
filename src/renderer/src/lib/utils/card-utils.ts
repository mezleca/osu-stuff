import type { IBeatmapResult, BeatmapSetResult } from "@shared/types";
import { url_to_media, string_is_valid } from "./utils";
import { config } from "../store/config";

import chroma from "chroma-js";

// @ts-ignore
import PLACEHOLDER_IMAGE from "@assets/images/fallback.png";

const diff_spec = chroma
    .scale(["#4290FB", "#4FC0FF", "#4FFFD5", "#7CFF4F", "#F6F05C", "#FF8068", "#FF4E6F", "#C645B8", "#6563DE", "#18158E", "#000000"])
    .domain([0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9]);

const diff_text_spec = chroma.scale(["#F6F05C", "#FF8068", "#FF4E6F", "#C645B8", "#6563DE", "#4F148F"]).domain([9, 9.9, 10.6, 11.5, 12.4]);

export const get_card_image_source = (item: IBeatmapResult | BeatmapSetResult): string => {
    if (!item) return PLACEHOLDER_IMAGE;

    if ("beatmapset_id" in item) {
        const beatmap = item as IBeatmapResult;

        // always check if we actually want to have local images
        if (config.get("local_images") === false) {
            return `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`;
        }

        if (beatmap.background) {
            const src = url_to_media(beatmap.background);
            if (string_is_valid(src)) return src;
        }

        // fallback to web asset
        return `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`;
    }

    if ("online_id" in item) {
        const beatmapset = item as BeatmapSetResult;

        // fallback to asset
        if (beatmapset.online_id > 0) {
            return `https://assets.ppy.sh/beatmaps/${beatmapset.online_id}/covers/cover.jpg`;
        }
    }

    return PLACEHOLDER_IMAGE;
};

export const get_diff_color = (rating: number): string => {
    if (rating < 0.1) return "#AAAAAA";
    if (rating >= 9) return "#000000";
    return diff_spec(rating).hex();
};

export const get_diff_text_color = (rating: number): string => {
    if (rating < 6.5) return "#000000";
    if (rating < 9) return "#F6F05C";
    return diff_text_spec(rating).hex();
};

export const get_placeholder_image = (): string => {
    return PLACEHOLDER_IMAGE;
};
