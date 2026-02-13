import { Writable, writable, get } from "svelte/store";
import { edit_notification, finish_notification, notification_exists, show_notification } from "./notifications";
import { throttle } from "../utils/timings";

const NOTIFICATION_ID = "update:progress";
const RELEASES_URL = "https://github.com/mezleca/osu-stuff/releases/latest";

interface UpdateProgress {
    available: boolean;
    updating: boolean;
    checking: boolean;
    installing: boolean;
    manual_update_required: boolean;
}

export const update_progress: Writable<UpdateProgress> = writable({
    available: false,
    updating: false,
    checking: false,
    installing: false,
    manual_update_required: false
});

const upsert_update_notification = (data: any) => {
    if (notification_exists(NOTIFICATION_ID)) {
        edit_notification(NOTIFICATION_ID, data);
        return;
    }

    show_notification({ id: NOTIFICATION_ID, persist: true, ...data });
};

const show_manual_update_notification = (reason: string) => {
    update_progress.set({ available: false, updating: false, checking: false, installing: false, manual_update_required: true });

    upsert_update_notification({
        type: "warning",
        persist: true,
        text: `failed to install automatically\n${reason}\n\nclick below to download manually`,
        actions: [
            {
                id: "manual-download",
                label: "download manually",
                close_on_click: false,
                on_click: async () => {
                    await window.api.invoke("shell:open", RELEASES_URL);
                }
            }
        ]
    });
};

const request_install = async () => {
    update_progress.update((state) => ({ ...state, installing: true }));
    upsert_update_notification({
        type: "info",
        persist: true,
        text: "installing update...\nplease wait",
        actions: []
    });

    const result = await window.api.invoke("updater:install");

    if (!result.success) {
        // @ts-ignore
        const reason = result.reason as string;
        show_manual_update_notification(reason);
    }
};

export const start_update = throttle(async () => {
    const progress_data = get(update_progress);

    try {
        if (!progress_data.available || progress_data.updating || progress_data.installing || progress_data.manual_update_required) {
            return;
        }

        update_progress.update((state) => ({ ...state, updating: true }));
        upsert_update_notification({
            type: "info",
            persist: true,
            text: "downloading update...\nplease wait",
            actions: []
        });

        const result = await window.api.invoke("updater:update");

        if (!result.success) {
            // @ts-ignore
            const reason = result.reason as string;

            if (reason.includes("install manually")) {
                show_manual_update_notification(reason);
                return;
            }

            upsert_update_notification({
                type: "error",
                persist: true,
                text: `failed to update\n${reason}`,
                actions: []
            });
            return;
        }
    } catch (err) {
        if (progress_data.updating) {
            upsert_update_notification({
                type: "error",
                persist: true,
                text: "failed to download update",
                actions: []
            });
        }
    } finally {
        update_progress.update((state) => ({ ...state, updating: false }));
    }
}, 100);

export const check_for_updates = () => {
    const data = get(update_progress);
    if (data.manual_update_required || data.checking || data.updating || data.installing) {
        return;
    }

    update_progress.update((state) => ({ ...state, checking: true }));
    upsert_update_notification({
        type: "info",
        persist: true,
        text: "looking for updates...",
        actions: []
    });

    window.api.invoke("updater:check");
};

window.api.on("updater:new", async (data) => {
    // @ts-ignore
    const version = data.version as string;
    update_progress.update((state) => ({ ...state, available: true, checking: false, manual_update_required: false }));

    upsert_update_notification({
        type: "confirm",
        persist: true,
        text: `new version available (${version})`,
        actions: [
            {
                id: "update-now",
                label: "update now",
                close_on_click: false,
                on_click: async () => {
                    await start_update();
                }
            },
            {
                id: "open-release",
                label: "open release page",
                close_on_click: false,
                on_click: async () => {
                    await window.api.invoke("shell:open", RELEASES_URL);
                }
            }
        ]
    });
});

window.api.on("updater:checking", () => {
    update_progress.update((state) => ({ ...state, checking: true }));
    upsert_update_notification({
        type: "info",
        persist: true,
        text: "looking for updates...",
        actions: []
    });
});

window.api.on("updater:not_available", () => {
    update_progress.update((state) => ({ ...state, checking: false, available: false }));
    finish_notification(NOTIFICATION_ID, {
        type: "success",
        text: "already on latest release",
        duration: 2500,
        actions: []
    });
});

window.api.on("updater:finish", async (data) => {
    update_progress.update((state) => ({ ...state, checking: false, updating: false, installing: false }));

    if (data.success) {
        update_progress.update((state) => ({ ...state, available: false, manual_update_required: false }));

        upsert_update_notification({
            type: "confirm",
            persist: true,
            text: "update downloaded\nrestart now?",
            actions: [
                {
                    id: "restart-now",
                    label: "restart now",
                    close_on_click: false,
                    on_click: async () => {
                        await request_install();
                    }
                },
                {
                    id: "restart-later",
                    label: "later",
                    close_on_click: true
                }
            ]
        });

        return;
    }

    // @ts-ignore
    const reason = data.reason as string;

    if (reason.includes("install manually")) {
        show_manual_update_notification(reason);
        return;
    }

    // update notification
    update_progress.update((state) => ({ ...state, available: true, manual_update_required: false }));
    upsert_update_notification({
        type: "error",
        persist: true,
        text: `failed to download update\n${reason}`,
        actions: []
    });
});
