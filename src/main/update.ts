import { autoUpdater } from "electron-updater";
import { handle_ipc, send_to_renderer } from "./ipc";
import { get_window } from "./database/utils";
import { beatmap_downloader } from "./osu/downloader";
import { beatmap_exporter } from "./osu/exporter";

class StuffUpdater {
    active: boolean = false;

    initialize = () => {
        autoUpdater.autoDownload = false;

        handle_ipc("updater:install", () => {
            autoUpdater.quitAndInstall();
        });

        handle_ipc("updater:check", () => {
            this.check();
        });

        handle_ipc("updater:update", () => {
            try {
                // check if we support auto update for the current system / package
                if (!autoUpdater.isUpdaterActive()) {
                    if (process.platform == "linux") {
                        return { success: false, reason: "auto update is only supported for AppImage... please download the update manually" };
                    } else {
                        return { success: false, reason: "auto update is not supported for this platform... please download the update manually" };
                    }
                }

                // prevent update if we're downloading / exporting
                if (beatmap_downloader.is_active()) {
                    return { success: false, reason: "beatmap downloader is active" };
                }

                if (beatmap_exporter.is_exporting()) {
                    return { success: false, reason: "beatmap exporter is active" };
                }

                autoUpdater.downloadUpdate();
                return { success: true, data: "download started" };
            } catch (err) {
                return { success: false, reason: err as string };
            }
        });

        autoUpdater.on("update-available", (data) => {
            const window = get_window("main");

            if (!window) {
                console.error("failed to get main window");
                return;
            }

            console.log("[updater] update available:", data);
            send_to_renderer(window.webContents, "updater:new", data);
        });

        // TODO: send updater:progress to renderer
        autoUpdater.on("download-progress", () => {
            this.active = true;
        });

        autoUpdater.on("update-downloaded", (data) => {
            const window = get_window("main");

            if (!window) {
                console.error("failed to get main window");
                return;
            }

            console.log("[updater] update downloaded:", data);

            this.active = false;
            send_to_renderer(window.webContents, "updater:finish", { success: true, data: data.version });
        });

        autoUpdater.on("error", (data) => {
            const window = get_window("main");

            if (!window) {
                console.error("failed to get main window");
                return;
            }

            console.error("[updater] error:", data);

            // skip update checks (only notify if we're downloading)
            if (this.active) {
                this.active = false;
                send_to_renderer(window.webContents, "updater:finish", { success: false, reason: data.message });
            }
        });

        this.check();
    };

    check() {
        autoUpdater.checkForUpdates();
    }
}

export const updater = new StuffUpdater();
