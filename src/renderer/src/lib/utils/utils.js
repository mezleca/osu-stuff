export const safe_text = (text) => {
    if (!text) {
        return "";
    }

    return String(text).replace(/[<>&"']/g, (char) => {
        switch (char) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case '"':
                return "&quot;";
            case "'":
                return "&#39;";
            default:
                return char;
        }
    });
};

export const safe_id = (id) => {
    return String(id).replace(/[^\w-]/g, "");
};

// @TODO: cache
export const get_from_media = async (file) => {
    const url = "media://" + encodeURI(file);
    const data = await window.fetch({ url });
    return data;
};

// @TODO: cache
export const get_image_url = async (file) => {
    const image = await get_from_media(file);
    const buffer = await image.arrayBuffer();
    const blob = new Blob([buffer], { type: "image/png" });

    return URL.createObjectURL(blob);
};

export const star_ranges = [
    [0, 2.99, "sr1"],
    [3, 4.99, "sr2"],
    [5, 6.99, "sr3"],
    [7, 7.99, "sr4"],
    [8, 8.99, "sr5"],
    [9, Infinity, "sr6"]
];

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

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// override fetch function (prevent cors on dev mode)
window.fetch = async (options = { url: null }) => {
    if (typeof options != "object") {
        console.log("not and object", options);
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
