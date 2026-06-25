import { autoUpdater } from "electron-updater";
import { handle_ipc, send_to_renderer } from "./ipc";
import { get_window } from "./utils";
import { beatmap_downloader } from "./osu/downloader";
import { beatmap_exporter } from "./osu/exporter";
import { GenericResult } from "@shared/types";

const RELEASES_URL = "https://github.com/mezleca/osu-stuff/releases/latest";

class StuffUpdater {
    active: boolean = false;
    installing: boolean = false;
    checking: boolean = false;

    initialize = () => {
        autoUpdater.autoDownload = false;

        handle_ipc("updater:install", () => {
            try {
                this.installing = true;
                autoUpdater.quitAndInstall();
                return { success: true, data: "install started" };
            } catch (err) {
                this.installing = false;
                return { success: false, reason: this.build_manual_update_reason(err) };
            }
        });

        handle_ipc("updater:check", () => {
            return this.check();
        });

        handle_ipc("updater:update", () => {
            try {
                // check if we support auto update for the current system / package
                if (!autoUpdater.isUpdaterActive()) {
                    if (process.platform == "linux") {
                        return { success: false, reason: `auto update is not available for this linux package. install manually: ${RELEASES_URL}` };
                    } else {
                        return { success: false, reason: `auto update is not supported for this platform. install manually: ${RELEASES_URL}` };
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
            this.checking = false;
            const window = get_window("main");

            if (!window) {
                console.error("failed to get main window");
                return;
            }

            console.log("[updater] update available:", data);
            send_to_renderer(window.webContents, "updater:new", data);
        });

        autoUpdater.on("checking-for-update", () => {
            this.checking = true;
            const window = get_window("main");

            if (!window) {
                console.error("failed to get main window");
                return;
            }

            send_to_renderer(window.webContents, "updater:checking", undefined);
        });

        autoUpdater.on("update-not-available", (data) => {
            this.checking = false;
            const window = get_window("main");

            if (!window) {
                console.error("failed to get main window");
                return;
            }

            send_to_renderer(window.webContents, "updater:not_available", data);
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
            this.checking = false;
            send_to_renderer(window.webContents, "updater:finish", { success: true, data: data.version });
        });

        autoUpdater.on("error", (data) => {
            const window = get_window("main");

            if (!window) {
                console.error("failed to get main window");
                return;
            }

            console.error("[updater] error:", data);

            if (this.checking) {
                this.checking = false;
                send_to_renderer(window.webContents, "updater:not_available", undefined);
            }

            // skip passive update checks errors, but notify on download/install flows.
            if (this.active || this.installing) {
                const is_install_error = this.installing;
                this.active = false;
                this.installing = false;

                const reason = is_install_error ? this.build_manual_update_reason(data) : data.message;
                send_to_renderer(window.webContents, "updater:finish", { success: false, reason });
            }
        });

        this.check();
    };

    check(): GenericResult<string> {
        const window = get_window("main");

        if (!autoUpdater.isUpdaterActive()) {
            this.checking = false;
            if (window) {
                send_to_renderer(window.webContents, "updater:not_available", undefined);
            }
            return { success: false, reason: "auto updater is not active in this build" } as const;
        }

        try {
            this.checking = true;
            autoUpdater.checkForUpdates();
            return { success: true, data: "check started" } as const;
        } catch (err) {
            this.checking = false;
            if (window) {
                send_to_renderer(window.webContents, "updater:not_available", undefined);
            }
            return { success: false, reason: err as string } as const;
        }
    }

    private build_manual_update_reason(err: unknown): string {
        const message = err instanceof Error ? err.message : String(err);
        return `failed to start auto install (${message}). install manually: ${RELEASES_URL}`;
    }
}

export const updater = new StuffUpdater();
