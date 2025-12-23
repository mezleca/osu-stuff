import type { FetchOptions, IFetchResponse } from "@shared/types";
import { writable } from "svelte/store";

export const url_from_media = (file: string): string => {
    return `media://${encodeURIComponent(file)}`;
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

export const debounce = (func: any, timeout = 100) => {
    let timer: any;
    return (...args: any) => {
        clearTimeout(timer);
        timer = setTimeout(() => func(...args), timeout);
    };
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

export const custom_fetch = async (options: FetchOptions): Promise<IFetchResponse> => {
    // TODO: why is this named "fetch:get"?
    return window.api.invoke("fetch:get", options);
};

export const context_separator = "<|=‎=|>";
export const is_dev_mode = writable(false);
export const mouse_position = { x: 0, y: 0 };

document.addEventListener("mousemove", (event) => {
    mouse_position.x = event.clientX;
    mouse_position.y = event.clientY;
});
