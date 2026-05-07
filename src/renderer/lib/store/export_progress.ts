import { show_progress_box, hide_progress_box } from "./progress_box";
import { config } from "../store/config";
import { core_state } from "./other.svelte";
import { edit_notification, finish_notification, notification_exists, show_notification } from "./notifications";
import type { ExportEvent, IExportState, INotification } from "@shared/types";

const EXPORT_PROGRESS_ID = "export";
const EXPORT_NOTIFICATION_ID = "export:status";

const show_export_notification = (data: Partial<INotification>) => {
    if (notification_exists(EXPORT_NOTIFICATION_ID)) {
        edit_notification(EXPORT_NOTIFICATION_ID, { persist: false, ...data });
        return;
    }

    show_notification({ id: EXPORT_NOTIFICATION_ID, persist: false, ...data });
};

const complete_export_notification = (data: Partial<INotification>) => {
    if (notification_exists(EXPORT_NOTIFICATION_ID)) {
        finish_notification(EXPORT_NOTIFICATION_ID, data);
        return;
    }

    show_notification({ id: EXPORT_NOTIFICATION_ID, persist: false, ...data });
};

const handle_export_progress = (event: Extract<ExportEvent, { type: "progress" }>) => {
    core_state.export.is_exporting = true;

    show_progress_box({
        id: EXPORT_PROGRESS_ID,
        text: event.text,
        progress: Math.floor((event.current / event.total) * 100),
        auto_hide: true
    });
};

const handle_export_finished = (event: Extract<ExportEvent, { type: "finished" }>) => {
    core_state.export.is_exporting = false;
    hide_progress_box(EXPORT_PROGRESS_ID);

    complete_export_notification({
        type: "success",
        text: `exported ${event.count} beatmaps`,
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
};

const handle_export_stopped = (event: Extract<ExportEvent, { type: "stopped" }>) => {
    core_state.export.is_exporting = false;
    hide_progress_box(EXPORT_PROGRESS_ID);

    complete_export_notification({
        type: event.reason == "cancelled by user" ? "warning" : "error",
        text: event.reason == "cancelled by user" ? "export cancelled" : event.reason,
        duration: event.reason == "cancelled by user" ? 3000 : 5000,
        actions: []
    });
};

window.api.on("export:event", (event: ExportEvent) => {
    if (event.type == "started") {
        core_state.export.is_exporting = true;
        show_export_notification({
            type: "info",
            text: `started exporting ${event.total} beatmaps`,
            duration: 3000,
            actions: []
        });
        return;
    }

    if (event.type == "progress") {
        handle_export_progress(event);
        return;
    }

    if (event.type == "finished") {
        handle_export_finished(event);
        return;
    }

    handle_export_stopped(event);
});

window.api.invoke("exporter:state").then((state: IExportState) => {
    if (state.is_exporting) {
        core_state.export.is_exporting = true;
        show_progress_box({
            id: EXPORT_PROGRESS_ID,
            text: `exporting ${state.current_beatmap}`,
            progress: Math.floor((state.current_index / state.total) * 100),
            auto_hide: true
        });
    }
});

export const stop_export = (id: string) => {
    window.api.invoke("exporter:stop", id);
};
