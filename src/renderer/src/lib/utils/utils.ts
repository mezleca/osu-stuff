import type { FetchOptions, IFetchResponse } from "@shared/types";
import { writable } from "svelte/store";

export const get_from_media = async (file: string): Promise<ArrayBuffer | undefined> => {
    const url = "media://" + encodeURI(file);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error("failed to get media", file, response.statusText);
            return undefined;
        }

        return await response.arrayBuffer();
    } catch (error) {
        console.error("failed to get media", file, error);
        return undefined;
    }
};

export const get_image_url = async (file: string): Promise<string | undefined> => {
    const buffer = await get_from_media(file);

    if (!buffer) {
        return undefined;
    }

    const blob = new Blob([buffer], { type: "image/png" });
    return URL.createObjectURL(blob);
};

export const open_on_browser = (id: number): void => {
    window.api.invoke("shell:open", `https://osu.ppy.sh/beatmapsets/${id}`);
};

export const debounce = (func: any, timeout = 100) => {
    let timer: any;
    return (...args: any) => {
        clearTimeout(timer);
        timer = setTimeout(() => func(...args), timeout);
    };
};

export const format_time = (secs: number) => {
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
