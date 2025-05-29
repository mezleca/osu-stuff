// APIS
export const fs = window.fs;
export const path = window.path;
export const zlib = window.zlib;
export const extra = window.extra;

// CONSTANTS
export const is_testing = window.process.env.STUFF_ENV == "dev";
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

export const BEATMAP_CARD_TEMPLATE = `
<div class="beatmap-card not-downloaded">
    <img class="bg-image">
    <div class="beatmap-card-data">
        <div class="beatmap-metadata">
            <div class="title">placeholder</div>
            <div class="subtitle">placeholder</div>
            <div class="beatmap-card-status">
                <div class="beatmap-status">UNKNOWN</div>
                <div class="beatmap-status star_fucking_rate">★ 0.00</div>
            </div>
        </div>
        <div class="beatmap-status-control">
            <button class="preview-button">
                <svg id="play-button" viewBox="0 0 84 100" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <polygon points="10,0 10,100 90,50"/>
                </svg>
            </button>      
            <button class="download-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-arrow-down-fill" viewBox="0 0 16 16">
                    <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0M9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1m-1 4v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 11.293V7.5a.5.5 0 0 1 1 0"/>
                </svg>
            </button>
            <button class="remove-btn">
                <svg viewBox="0 0 10 10" width="14px" height="14px" stroke="currentColor" stroke-width="2">
                    <path d="M1,1 9,9 M9,1 1,9" />
                </svg>
            </button>
        </div>
    </div>
</div>
`