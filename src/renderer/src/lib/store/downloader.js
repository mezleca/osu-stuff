import { writable } from "svelte/store";
import { show_notification } from "./notifications";

const progress_update_data = {
    name: "",
    index: 0,
    length: 0,
    failed: false,
    finished: false
};

const download_data = {
    name: "",
    beatmaps: [],
    index: 0,
    paused: false,
    finished: false,
    progress: { index: 0, length: 0, failed: 0 }
};

/*
    contextBridge.exposeInMainWorld("downloader", {
        add: (obj) => ipcRenderer.invoke("add-download", obj),
        add_mirror: (obj) => ipcRenderer.invoke("add-mirror", obj),
        set_token: (token) => ipcRenderer.invoke("set-token", token),
        start: (name) => ipcRenderer.invoke("start-download", name),
        stop: () => ipcRenderer.invoke("stop-download"),
        all: () => ipcRenderer.invoke("get-downloads"),
        remove: (name) => ipcRenderer.invoke("remove-download", name),
        remove_mirror: (name) => ipcRenderer.invoke("remove-mirror", name),
        on_download_progress: (callback) => {
            ipcRenderer.on("download-progress", (_, data) => callback(data));
        }
    });
*/

class Downloader {
    constructor() {
        this.downloads = writable([]);
    }

    async initialize() {
        // check if theres any download on background
        const result = await window.downloader.all();

        if (!result) {
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

        const result = await window.downloader.add(download);

        // @TODO: reason
        if (!result) {
            show_notification({ type: "error", text: "failed to add download" });
            return;
        }

        this.downloads.update((old) => [...old, download]);
    }

    stop(name) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to stop download (invalid name)" });
            return;
        }
    }

    remove(name) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to remove download (invalid name)" });
            return;
        }
    }

    /** @param {progress_update_data} data */
    update_progress(data) {
        console.log(`[downloader] | name: ${data.name} | index: ${data.index} | failed: ${data.failed} | finished: ${data.finished}`);
        // remove finished download
        if (data.finished) {
            this.remove(data.name);
            return;
        }

        this.downloads.update((old) => [...old.filter((d) => d.name != data.name), data]);
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
window.downloader.on_download_progress(downloader.update_progress);
