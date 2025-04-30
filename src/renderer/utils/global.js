// APIS
export const fs = window.fs;
export const path = window.path;
export const zlib = window.zlib;
export const extra = window.extra;

// CONSTANTS
export const is_testing = window.process.env.STUFF_ENV == "development";
export const placeholder_image = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
export const OSU_STATS_URL = "https://osustats.ppy.sh/apiv2/account/login?returnUrl=https://osustats.ppy.sh/";
export const MAX_RENDER_AMMOUNT = 8;
export const DRAG_ACTIVATION_THRESHOLD_MS = 500;
export const CONTEXT_FADE_MS = 50;

export const cursor = {
    x: 0,
    y: 0
}

// OTHER GARBAGE
export const star_ranges = [
    [0, 2.99, "sr1"],
    [3, 4.99, "sr2"],
    [5, 6.99, "sr3"],
    [7, 7.99, "sr4"],
    [8, 8.99, "sr5"],
    [9, Infinity, "sr6"]
];

export const gamemodes = {
    "osu!": 0,
    "taiko": 1,
    "ctb": 2,
    "mania": 3,
};

export const safe_text = (text) => {

    if (!text) {
        return "";
    }

    return String(text).replace(/[<>&"']/g, char => {
        switch(char) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return char;
        }
    });
};

export const safe_id = (id) => {
    return String(id).replace(/[^\w-]/g, '');
};

export const create_element = (data, style) => {
    
    const content = new DOMParser().parseFromString(data, "text/html").body;
    const element = content.firstElementChild;

    // kinda useless 
    if (style) {

        for (const [target_id, data] of Object.entries(style)) {

            const target = content.querySelector(`.${target_id}`);
    
            if (!target) {
                continue;
            }

            for (const [k, v] of Object.entries(data)) {
                target.style[k] = v;
            }            
        }
    }
    
    return element;
};

export function debounce (func, timeout = 250) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

document.addEventListener("mousemove", (e) => {
    cursor.x = e.clientX;
    cursor.y = e.clientY;
});