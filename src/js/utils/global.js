export const fs = window.nodeAPI.fs;
export const path = window.nodeAPI.path;
export const zlib = window.nodeAPI.zlib;
export const collections = new Map();
export const is_testing = window.electron.dev_mode;
export const placeholder_image = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
export const MAX_RENDER_AMMOUNT = 16;
export const DRAG_ACTIVATION_THRESHOLD_MS = 500;

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

export const debounce = (func, delay) => {

    let timeout;

    return (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), delay)
    }
};
