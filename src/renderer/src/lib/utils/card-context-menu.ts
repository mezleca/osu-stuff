import type { ContextMenuOption, IBeatmapResult, BeatmapSetResult } from "@shared/types";
import { collections } from "../store/collections";
import { open_on_browser } from "./utils";

export const get_beatmap_context_options = (beatmap: IBeatmapResult | null, show_remove: boolean): ContextMenuOption[] => {
    const all_collections = collections.get_all();
    const options: ContextMenuOption[] = [];

    if (beatmap) {
        options.push({ id: "browser", text: "open on browser" });
    }

    if (all_collections.length) {
        const move_sub_options: ContextMenuOption[] = all_collections.map((c) => {
            return {
                id: `move-${c.name}`,
                text: c.name
            };
        });

        options.push({ id: "move", text: "move to", data: move_sub_options });
    }

    options.push({ id: "export", text: "export beatmap" });

    if (show_remove) {
        options.push({ id: "remove", text: "remove beatmap" });
    }

    return options;
};

export const get_beatmapset_context_options = (show_remove: boolean): ContextMenuOption[] => {
    const all_collections = collections.get_all();
    const options: ContextMenuOption[] = [];

    options.push({ id: "browser", text: "open on browser" });

    if (all_collections.length) {
        const move_sub_options: ContextMenuOption[] = all_collections.map((c) => {
            return {
                id: `move-${c.name}`,
                text: c.name
            };
        });

        options.push({ id: "move", text: "move to", data: move_sub_options });
    }

    options.push({ id: "export", text: "export beatmapset" });

    if (show_remove) {
        options.push({ id: "remove", text: "remove beatmapset" });
    }

    return options;
};

export const handle_card_context_action = (
    action: string,
    id: string,
    beatmap_or_set: IBeatmapResult | BeatmapSetResult,
    on_remove: (id: string | number) => void
) => {
    const is_set = "beatmaps" in beatmap_or_set;
    const online_id = beatmap_or_set.online_id;
    const beatmapset_id = beatmap_or_set.beatmapset_id;

    switch (action) {
        case "browser":
            open_on_browser(beatmapset_id);
            break;
        case "move": {
            const collection = id;
            const hashes = is_set ? (beatmap_or_set as BeatmapSetResult).beatmaps : [(beatmap_or_set as IBeatmapResult).md5];

            collections.add_beatmaps(collection, hashes);
            break;
        }
        case "export":
            window.api.invoke("driver:export_beatmapset", online_id);
            break;
        case "remove":
            on_remove(is_set ? online_id : (beatmap_or_set as IBeatmapResult).md5);
            break;
    }
};
