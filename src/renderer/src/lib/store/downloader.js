import { get, writable } from "svelte/store";
import { show_notification } from "./notifications";

const download_data = {
    name: "",
    beatmaps: [],
    paused: false,
    finished: false,
    progress: { index: 0, length: 0, failed: 0 }
};

class Downloader {
    constructor() {
        this.downloads = writable([]);
    }

    async initialize() {
        // check if theres any download on background
        const result = await window.downloader.all();

        if (!result || result?.length == 0) {
            return;
        }

        this.downloads.set(result);
    }

    /** @param {download_data} download */
    async add(download) {
        if (!download.name || download.name == "") {
            show_notification({ type: "error", text: "invalid download name" });
            return;
        }

        const new_download = { ...download_data, ...download };

        // add the download before to prevent race condition
        this.downloads.update((old) => [...old, new_download]);

        const result = await window.downloader.add(new_download);

        // @TODO: reason
        if (!result) {
            this.remove(download.name);
            show_notification({ type: "error", text: "failed to add download" });
            return;
        }
    }

    async stop(name) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to stop download (invalid name)" });
            return;
        }

        this.downloads.update((old) =>
            old.map((download) => {
                if (download.name == name) {
                    download.paused = true;
                }
                return download;
            })
        );

        const result = await window.downloader.stop(name);

        if (!result) {
            show_notification({ type: "error", text: "failed to stop " + name });
            return;
        }
    }

    async resume(name) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to resume download (invalid name)" });
            return;
        }

        this.downloads.update((old) =>
            old.map((download) => {
                if (download.name == name) {
                    download.paused = false;
                }
                return download;
            })
        );

        const result = await window.downloader.resume(name);

        if (!result) {
            show_notification({ type: "error", text: "failed to resume " + name });
            return;
        }
    }

    remove(name) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to remove download (invalid name)" });
            return;
        }

        this.downloads.update((old) => old.filter((d) => d.name != name));
        window.downloader.remove(name);
    }

    update_progress(download) {
        const { data, reason } = download;

        console.log(
            `[downloader] | name: ${data.name} | index: ${data.progress.index} | failed: ${data.progress.failed} | paused: ${data.paused} | finished: ${data.finished}`
        );

        if (data.finished) {
            this.remove(data.name);
            return;
        }

        if (data.paused && reason) {
            show_notification({ type: "alert", text: reason });
        }

        this.downloads.update((old) => {
            const updated = old.map((old_download) => {
                if (old_download.name == data.name) {
                    return data;
                }
                return old_download;
            });

            return updated;
        });
    }

    async update_token(token) {
        if (!token || token == "") {
            show_notification({ type: "error", text: "failed to update downloader token (invalid)" });
            return;
        }

        await window.downloader.set_token(token);
    }
}

export const downloader = new Downloader();

// initialize downloader
await downloader.initialize();

// add listeners
window.downloader.on_download_progress((data) => downloader.update_progress(data));
