import { show_progress_box, hide_progress_box } from "./progress_box";
import { config } from "../store/config";
import { show_notification } from "./notifications";

const EXPORT_PROGRESS_ID = "export";

interface IExportUpdate {
    current: number;
    total: number;
    text: string;
}

interface IExportFinish {
    success: boolean;
    count?: number;
    reason?: string;
}

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
});

window.api.on("export:finish", (event: any) => {
    const data = event as IExportFinish;

    config.is_exporting.set(false);
    hide_progress_box(EXPORT_PROGRESS_ID);

    if (data.success) {
        show_notification({ type: "success", text: `exported ${data.count} beatmaps` });
    } else {
        if (data.reason != "cancelled by user") {
            show_notification({ type: "error", text: data.reason || "export failed" });
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
    }
});

export const cancel_export = () => {
    window.api.invoke("exporter:cancel");
};
