import { type Writable, writable } from "svelte/store";
import { show_notification } from "./notifications";
import type { IBeatmapResult, IDownloadData, IDownloadProgress, IDownloadEvent } from "@shared/types";
import { config } from "./config";

class Downloader {
    data: Writable<IDownloadData[]>;

    constructor() {
        this.data = writable([]);
    }

    async initialize() {
        const result = await window.api.invoke("downloader:get");

        if (result && result.length > 0) {
            this.data.set(result);
        }
    }

    async add(download: IDownloadData) {
        if (!config.authenticated) {
            show_notification({ type: "error", text: "not authenticated bro" });
            return;
        }

        if (!download.id || download.id == "") {
            show_notification({ type: "error", text: "invalid download name" });
            return;
        }

        const result = await window.api.invoke("downloader:add", download);

        if (!result) {
            show_notification({ type: "error", text: "failed to add download" });
        }
    }

    async single_download(beatmap: IBeatmapResult) {
        if (!config.authenticated) {
            show_notification({ type: "error", text: "not authenticated bro" });
            return false;
        }

        if (!beatmap.online_id && !beatmap.md5) {
            show_notification({ type: "error", text: "missing md5 / id" });
            return false;
        }

        const result = await window.api.invoke("downloader:single", {
            beatmapset_id: beatmap.online_id,
            md5: beatmap.md5
        });

        return result;
    }

    async pause(name: string) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to pause: invalid name" });
            return false;
        }

        const result = await window.api.invoke("downloader:pause", name);

        if (!result) {
            show_notification({ type: "error", text: "failed to pause: " + name });
            return false;
        }

        return true;
    }

    async resume(name: string) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to resume: invalid name" });
            return false;
        }

        const result = await window.api.invoke("downloader:resume", name);

        if (!result) {
            show_notification({ type: "error", text: "failed to resume: " + name });
            return false;
        }

        return false;
    }

    async remove(name: string) {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to remove: invalid name" });
            return false;
        }

        const result = await window.api.invoke("downloader:remove", name);

        if (!result) {
            show_notification({ type: "error", text: "failed to remove: " + name });
            return false;
        }

        return true;
    }

    update(data: IDownloadProgress) {
        this.data.update((downloads) =>
            downloads.map((download) => {
                if (download.id == data.id) {
                    download = { ...download, ...data };
                }
                return download;
            })
        );
    }

    on_event(event: IDownloadEvent) {
        // early return on those events
        if (event.type == "no mirrors") {
            show_notification({ type: "error", text: "needs at least one beatmap mirror " });
            return;
        }

        const download_id = event.data.id;

        switch (event.type) {
            case "started":
                show_notification({ type: "info", text: `downloading: ${download_id}` });
                break;
            case "finished":
                show_notification({ type: "success", text: `finished downloading: ${download_id}` });
                break;
            case "resumed":
                show_notification({ type: "info", text: `downloading: ${download_id}` });
                break;
            case "update":
            case "paused":
                break;
        }

        this.update(event.data);
    }
}

export const downloader = new Downloader();

// handle downloader events
window.api.on("downloader:events", downloader.on_event);
