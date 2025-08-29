import { writable } from "svelte/store";

export const get_from_media = async (file) => {
    const url = "media://" + encodeURI(file);
    const data = await window.fetch({ url });
    return data;
};

export const get_image_url = async (file) => {
    const image = await get_from_media(file);
    const buffer = await image.arrayBuffer();
    const blob = new Blob([buffer], { type: "image/png" });

    return URL.createObjectURL(blob);
};

export const debounce = (func, timeout = 100) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func(...args), timeout);
    };
};

export const format_time = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const string_is_valid = (value) => {
    if (value == "" || value == " ") return false;
    return true;
};

export const context_separator = "<|=‎=|>";
export const is_dev_mode = writable(false);

// override fetch function (prevent cors on dev mode)
window.fetch = async (options = { url: null }) => {
    if (typeof options != "object") {
        return;
    }

    const result = await window.extra.fetch(options);

    if (!result.ok) {
        result.error = new Error(result.error || `HTTP ${result.status}: ${result.status_text}`);
    }

    return {
        ok: result.ok,
        status: result.status,
        statusText: result.status_text,
        headers: new Headers(result.headers),
        json: () => result.data,
        text: () => (typeof result.data == "string" ? result.data : JSON.stringify(result.data)),
        arrayBuffer: () => Promise.resolve(result.data)
    };
};
