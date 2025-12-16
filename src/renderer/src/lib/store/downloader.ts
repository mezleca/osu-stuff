import { get, type Writable, writable } from "svelte/store";
import { show_notification } from "./notifications";
import { show_progress_box, hide_progress_box } from "./progress_box";
import type { IBeatmapResult, IDownloadData, IDownloadProgress, IDownloadEvent, IMinimalBeatmap, IDownloadedBeatmap } from "@shared/types";
import { config } from "./config";
import { active_tab } from "./other";

const DOWNLOAD_PROGRESS_ID = "download";

class Downloader {
    data: Writable<IDownloadData[]>;
    active_singles: Writable<Set<String>> = writable(new Set());
    private unsubscribe_events: (() => void) | null = null;

    constructor() {
        this.data = writable([]);
    }

    initialize = async () => {
        const result = await window.api.invoke("downloader:get");

        if (result && result.length > 0) {
            this.data.set(result);
        }

        if (!this.unsubscribe_events) {
            this.unsubscribe_events = window.api.on("downloader:events", (event) => this.on_event(event));
        }
    };

    add = async (download: IDownloadData) => {
        if (!config.authenticated) {
            show_notification({ type: "error", text: "not authenticated bro" });
            return;
        }

        if (get(config.mirrors).length == 0) {
            show_notification({ type: "error", text: "cant start a download with no mirrors..." });
            return;
        }

        if (!download.id || download.id == "") {
            show_notification({ type: "error", text: "invalid download name" });
            return;
        }

        // check if download with same id already exists
        const existing = get(this.data).find((d) => d.id == download.id);

        if (existing) {
            show_notification({ type: "error", text: `download "${download.id}" already exists` });
            return;
        }

        // get initial state
        const current_downloads = get(this.data);
        const has_active_download = current_downloads.some((d) => !d.progress?.paused);

        const new_download: IDownloadData = {
            ...download,
            progress: {
                id: download.id,
                paused: has_active_download,
                length: download.beatmaps.length,
                current: 0
            }
        };

        const result = await window.api.invoke("downloader:add", new_download);

        if (!result) {
            show_notification({ type: "error", text: "failed to add download (unknown error)" });
            return;
        }

        this.data.update((downloads) => [...downloads, new_download]);
    };

    single_download = async (beatmap: IDownloadedBeatmap) => {
        if (!config.authenticated) {
            show_notification({ type: "error", text: "not authenticated bro" });
            return false;
        }

        if (!beatmap.beatmapset_id && !beatmap.md5) {
            show_notification({ type: "error", text: "missing md5 / id" });
            return false;
        }

        // TODO: this might be too much but maybe some way to get the actual kb progress would be cool
        this.active_singles.update((s) => {
            s.add(beatmap.md5);
            return s;
        });

        const result = await window.api.invoke("downloader:single", beatmap);

        this.active_singles.update((s) => {
            s.delete(beatmap.md5);
            return s;
        });

        return result;
    };

    pause = async (name: string) => {
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
    };

    resume = async (name: string) => {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to resume: invalid name" });
            return false;
        }

        const result = await window.api.invoke("downloader:resume", name);

        if (!result) {
            show_notification({ type: "error", text: "failed to resume: " + name });
            return false;
        }

        return true;
    };

    remove = async (name: string) => {
        if (!name || name == "") {
            show_notification({ type: "error", text: "failed to remove: invalid name" });
            return false;
        }

        const result = await window.api.invoke("downloader:remove", name);

        if (!result) {
            show_notification({ type: "error", text: "failed to remove: " + name });
            return false;
        }

        // remove from local store
        this.data.update((downloads) => downloads.filter((d) => d.id != name));
        return true;
    };

    update = (data: IDownloadProgress) => {
        this.data.update((downloads) =>
            downloads.map((download) => {
                if (download.id == data.id) {
                    return { ...download, progress: data };
                }
                return download;
            })
        );
    };

    on_event = (event: IDownloadEvent) => {
        // early return on those events
        if (event.type == "no mirrors") {
            show_notification({ type: "error", text: "the current download has been paused due to no mirrors available" });
            return;
        }

        const download_id = event.data.id;

        // update store first
        this.update(event.data);

        switch (event.type) {
            case "finished":
                show_notification({ type: "success", text: `finished: ${download_id}` });
                hide_progress_box(DOWNLOAD_PROGRESS_ID);
                this.data.update((downloads) => downloads.filter((d) => d.id != download_id));
                return;
            case "paused":
                hide_progress_box(DOWNLOAD_PROGRESS_ID);
                break;
            case "resumed":
            case "started":
            case "update": {
                // hide progress box if we are on status tab
                if (get(active_tab) == "Status") {
                    hide_progress_box(DOWNLOAD_PROGRESS_ID);
                    break;
                }

                const current_download = get(this.data).find((d) => d.id == download_id);

                if (current_download && current_download.progress) {
                    const { current, length } = current_download.progress;
                    const progress = Math.floor((current / length) * 100) || 0;

                    show_progress_box({
                        id: DOWNLOAD_PROGRESS_ID,
                        text: `${download_id} (${current}/${length})`,
                        progress
                    });
                }
                break;
            }
        }
    };
}

export const downloader = new Downloader();
