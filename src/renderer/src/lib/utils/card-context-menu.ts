import type { ContextMenuOption, IBeatmapResult, BeatmapSetResult } from "@shared/types";
import { collections } from "../store/collections";
import { open_on_browser } from "./utils";
import { edit_notification, finish_notification, notification_exists, show_notification } from "../store/notifications";
import { config } from "../store/config";
import { beatmap_preview } from "./beatmaps";
import { modals, ModalType } from "./modal";
import { get_beatmap_list } from "../store/beatmaps";

const EXPORT_CARD_NOTIFICATION_ID = "export:single_beatmapset";

const show_or_update_export_card_notification = (data: any) => {
    if (notification_exists(EXPORT_CARD_NOTIFICATION_ID)) {
        edit_notification(EXPORT_CARD_NOTIFICATION_ID, { persist: true, ...data });
        return;
    }

    show_notification({ id: EXPORT_CARD_NOTIFICATION_ID, persist: true, ...data });
};

export const get_beatmap_context_options = (beatmap: IBeatmapResult | null, show_remove: boolean): ContextMenuOption[] => {
    const all_collections = collections.get_all();
    const options: ContextMenuOption[] = [];

    if (beatmap) {
        options.push({ id: "browser", text: "open on browser" }, { id: "preview", text: "preview beatmap" });
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
        options.push({ id: "remove set", text: "remove beatmapset" });
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

export const handle_card_context_action = async (
    action: string,
    id: string,
    beatmap: IBeatmapResult | BeatmapSetResult,
    on_remove?: (id: string | number) => void,
    on_remove_set?: (id: number) => void,
    filtered_hashes: string[] = []
) => {
    const is_set = "beatmaps" in (beatmap as BeatmapSetResult);
    const beatmapsed_id = is_set ? (beatmap as BeatmapSetResult).online_id : (beatmap as IBeatmapResult).beatmapset_id;

    switch (action) {
        case "browser":
            open_on_browser(beatmapsed_id);
            break;
        case "move": {
            const collection = id;
            const hashes = is_set
                ? filtered_hashes.length > 0
                    ? filtered_hashes
                    : (beatmap as BeatmapSetResult).beatmaps
                : [(beatmap as IBeatmapResult).md5];

            // add beatmaps to the target collection
            await collections.add_beatmaps(collection, hashes);

            // set update so if we're on another tab (e.g. browser) we dont have to wait for that
            get_beatmap_list("collections")?.set_update(true);
            break;
        }
        case "preview": {
            if (!beatmap || is_set) break;
            beatmap_preview.set(beatmap as IBeatmapResult);
            modals.show(ModalType.beatmap_preview);
            break;
        }
        case "export": {
            show_or_update_export_card_notification({
                type: "info",
                text: `exporting beatmapset #${beatmapsed_id}...`,
                actions: []
            });

            const result = await window.api.invoke("client:export_beatmapset", beatmapsed_id);

            if (result) {
                finish_notification(EXPORT_CARD_NOTIFICATION_ID, {
                    type: "success",
                    text: `finished exporting at ${config.get("export_path")}`,
                    duration: 8000,
                    actions: [
                        {
                            id: "open-folder",
                            label: "open folder",
                            close_on_click: true,
                            on_click: async () => {
                                await window.api.invoke("shell:open_path", config.get("export_path"));
                            }
                        }
                    ]
                });
            } else {
                finish_notification(EXPORT_CARD_NOTIFICATION_ID, {
                    type: "error",
                    text: "failed to export beatmapset",
                    duration: 5000,
                    actions: []
                });
            }

            break;
        }
        case "remove": {
            if (on_remove) on_remove(is_set ? beatmapsed_id : (beatmap as IBeatmapResult).md5);
            break;
        }
        case "remove set": {
            if (on_remove_set) on_remove_set(is_set ? beatmapsed_id : (beatmap as IBeatmapResult).beatmapset_id);
            break;
        }
    }
};
