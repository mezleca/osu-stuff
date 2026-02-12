import type { FetchOptions, IFetchResponse } from "@shared/types";
import { writable } from "svelte/store";

export const url_to_media = (file: string): string => {
    return `media://${encodeURIComponent(file)}`;
};

export const url_to_resources = (file: string): string => {
    return `resources://${encodeURI(file)}`;
};

export const open_on_browser = (id: number): void => {
    window.api.invoke("shell:open", `https://osu.ppy.sh/beatmapsets/${id}`);
};

export const get_local_audio = async (audio_path: string): Promise<HTMLAudioElement | null> => {
    if (!audio_path) {
        console.log("no audio_path provided");
        return null;
    }

    try {
        const result = await window.api.invoke("media:get_buffer", audio_path);

        if (!result.success) {
            return null;
        }

        const blob = new Blob([result.data as any]);

        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audio.preload = "auto";

        // store blob url on the element to revoke it later
        (audio as any)._blob_url = url;

        return audio;
    } catch (error) {
        console.log("error creating local audio:", audio_path, error);
        return null;
    }
};

export const format_time = (secs: number) => {
    if (!isFinite(secs) || isNaN(secs)) {
        return "0:00";
    }

    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const string_is_valid = (value: string) => {
    if (typeof value != "string") return false;
    if (!value || value == "") return false;
    if (value?.trim() == "") return false;
    return true;
};

export const get_dirname = (file_path: string): string => {
    if (!file_path) return ".";

    // remove trailing slashes
    let path = file_path;

    while (path.length > 1 && path[path.length - 1] === "/") {
        path = path.slice(0, -1);
    }

    // find last slash
    const last_slash = path.lastIndexOf("/");

    if (last_slash === -1) return ".";
    if (last_slash === 0) return "/";

    // return everything before last slash
    return path.slice(0, last_slash);
};

export const get_basename = (file_path: string, extension?: string): string => {
    if (!file_path) return "";

    // remove trailing slashes
    let path = file_path;

    while (path.length > 1 && path[path.length - 1] === "/") {
        path = path.slice(0, -1);
    }

    const last_slash = path.lastIndexOf("/");
    const filename = last_slash === -1 ? path : path.slice(last_slash + 1);

    // remove extension if provided
    if (extension && filename.endsWith(extension)) {
        return filename.slice(0, -extension.length);
    }

    return filename;
};

export const custom_fetch = async (options: FetchOptions): Promise<IFetchResponse> => {
    return window.api.invoke("fetch:get", options);
};

export const context_separator = "<|=‎=|>";
export const is_dev_mode = writable(false);
export const mouse_position = { x: 0, y: 0 };

document.addEventListener("mousemove", (event) => {
    mouse_position.x = event.clientX;
    mouse_position.y = event.clientY;
});
