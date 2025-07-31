import { writable } from "svelte/store";
import { show_notification } from "./notifications";

const ignored_update_messages = ["download paused"];

class Downloader {
    constructor() {
        this.downloads = writable([]);
    }

    async initialize() {
        const result = await window.downloader.all();

        if (result && result.length > 0) {
            this.downloads.set(result);
        }
    }

    async add(download) {
        if (!download.name || download.name == "") {
            show_notification({ type: "error", text: "invalid download name" });
            return;
        }

        const result = await window.downloader.add(download);

        if (!result) {
            show_notification({ type: "error", text: "failed to add download" });
            return;
        }
    }

    async single_download(beatmap) {
        if (!beatmap.id && !beatmap.md5) {
            show_notification({ type: "error", text: "beatmap object is invalid" });
            return;
        }

        // make sure beatmapset_id exists
        if (!beatmap.beatmapset_id && beatmap.id) {
            beatmap.beatmapset_id = beatmap.id;
        }

        const result = await window.downloader.single(beatmap);

        if (!result) {
            show_notification({ type: "error", text: "failed to download beatmap..." });
            return;
        }

        show_notification({ type: "success", text: `downloaded (${result.title})` });
        return result;
    }

    async stop(name) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to stop download (invalid name)" });
            return;
        }

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

        window.downloader.remove(name);
    }

    update_downloads({ downloads, reason }) {
        // update downloads data
        this.downloads.set(downloads);

        if (reason && !ignored_update_messages.includes(reason)) {
            show_notification({ type: "alert", text: reason });
        }
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

// add listener
window.downloader.on_downloads_update((data) => downloader.update_downloads(data));
