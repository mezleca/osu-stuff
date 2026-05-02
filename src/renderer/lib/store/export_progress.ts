import { show_progress_box, hide_progress_box } from "./progress_box";
import { config } from "../store/config";
import { edit_notification, finish_notification, notification_exists, show_notification } from "./notifications";
import type { IExportFinish, IExportUpdate } from "@shared/types";

const EXPORT_PROGRESS_ID = "export";
const EXPORT_NOTIFICATION_ID = "export:status";

const show_or_update_export_notification = (data: any) => {
    if (notification_exists(EXPORT_NOTIFICATION_ID)) {
        edit_notification(EXPORT_NOTIFICATION_ID, { persist: true, ...data });
        return;
    }

    show_notification({ id: EXPORT_NOTIFICATION_ID, persist: true, ...data });
};

window.api.on("export:update", (event: any) => {
    const data = event as IExportUpdate;
    const progress = Math.floor((data.current / data.total) * 100);

    config.is_exporting.set(true);

    show_progress_box({
        id: EXPORT_PROGRESS_ID,
        text: data.text,
        progress,
        auto_hide: true
    });

    show_or_update_export_notification({
        type: "info",
        text: `${data.text} (${data.current}/${data.total})`,
        actions: []
    });
});

window.api.on("export:finish", (event: any) => {
    const data = event as IExportFinish;

    config.is_exporting.set(false);
    hide_progress_box(EXPORT_PROGRESS_ID);

    if (data.success) {
        finish_notification(EXPORT_NOTIFICATION_ID, {
            type: "success",
            text: `exported ${data.count} beatmaps`,
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
        if (data.reason != "cancelled by user") {
            finish_notification(EXPORT_NOTIFICATION_ID, {
                type: "error",
                text: data.reason || "export failed",
                duration: 5000,
                actions: []
            });
        } else {
            finish_notification(EXPORT_NOTIFICATION_ID, {
                type: "warning",
                text: "export cancelled",
                duration: 3000,
                actions: []
            });
        }
    }
});

window.api.invoke("exporter:state").then((state: any) => {
    if (state.is_exporting) {
        config.is_exporting.set(true);
        show_progress_box({
            id: EXPORT_PROGRESS_ID,
            text: `exporting ${state.current_beatmap}`,
            progress: Math.floor((state.current_index / state.total) * 100),
            auto_hide: true
        });

        show_or_update_export_notification({
            type: "info",
            text: `exporting ${state.current_beatmap} (${state.current_index}/${state.total})`,
            actions: []
        });
    }
});

export const cancel_export = () => {
    window.api.invoke("exporter:cancel");
};
