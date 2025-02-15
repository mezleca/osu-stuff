// shit that i will use in various files

export const fs = window.nodeAPI.fs;
export const path = window.nodeAPI.path;
export const zlib = window.nodeAPI.zlib;
export const collections = new Map();

export const is_testing = window.electron.dev_mode;

export const debounce = (func, delay) => {

    let timeout;

    return (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), delay)
    }
};