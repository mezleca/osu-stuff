import { Writable, writable, get } from "svelte/store";
import { finish_notification, show_notification } from "./notifications";
import { quick_confirm } from "../utils/modal";
import { throttle } from "../utils/timings";

const NOTIFICATION_ID = "update:progress";

interface UpdateProgress {
    available: boolean;
    updating: boolean;
}

export const update_progress: Writable<UpdateProgress> = writable({
    available: false,
    updating: false
});

export const start_update = throttle(async () => {
    const progress_data = get(update_progress);

    try {
        if (!progress_data.available || progress_data.updating) {
            return;
        }

        progress_data.updating = true;

        // TOFIX: im not sure if electron-builder will notify errors on downloadUpdate thing
        const result = await window.api.invoke("updater:update");

        if (!result.success) {
            // @ts-ignore
            show_notification({ type: "error", text: `failed to update: ${result.reason}` });
            return;
        }

        // create a persistent notification
        show_notification({ id: NOTIFICATION_ID, type: "info", text: "updating...", persist: true });
    } catch (err) {
        if (progress_data.updating) finish_notification(NOTIFICATION_ID, { text: "finished downloading (restart me :3)", type: "error" });
    } finally {
        progress_data.updating = false;
        update_progress.set(progress_data);
    }
}, 100);

export const check_for_updates = () => {
    window.api.invoke("updater:check");
};

window.api.on("updater:new", async (data) => {
    show_notification({ type: "warning", text: `a new version of osu-stuff is available! (${data.version})` });
    update_progress.update((u) => ({ ...u, available: true }));
});

window.api.on("updater:finish", async (data) => {
    if (data.success) {
        update_progress.set({ available: false, updating: false });
        finish_notification(NOTIFICATION_ID, { text: "finished downloading", type: "success" });

        const confirm = await quick_confirm("update downloaded. restart now?", {
            submit: "yeah",
            cancel: "later"
        });

        if (confirm) {
            await window.api.invoke("updater:install");
        }

        return;
    }

    // update notification
    update_progress.set({ available: true, updating: false });
    // @ts-ignore
    finish_notification(NOTIFICATION_ID, { text: `failed to download.. ${data.reason}`, type: "error" });
});
