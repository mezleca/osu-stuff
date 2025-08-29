const { contextBridge, ipcRenderer, shell } = require("electron");
const path = require("path");
import { check_folder_permissions } from "./utils/validator.js";

contextBridge.exposeInMainWorld("config", {
    get: () => ipcRenderer.invoke("get-config"),
    update: (values) => ipcRenderer.invoke("update-config", values)
});

contextBridge.exposeInMainWorld("osu", {
    add_beatmap: (md5, beatmap) => ipcRenderer.invoke("add-beatmap", md5, beatmap),
    get_beatmaps: (force) => ipcRenderer.invoke("get-beatmaps", force),
    get_beatmap: (md5, query) => ipcRenderer.invoke("get-beatmap", md5, query),
    get_beatmap_by_id: (id) => ipcRenderer.invoke("get-beatmap-by-id", id),
    get_beatmap_by_md5: (md5) => ipcRenderer.invoke("get-beatmap-by-md5", md5),
    missing_beatmaps: (beatmaps) => ipcRenderer.invoke("missing-beatmaps", beatmaps),
    export_collection: (type, beatmtaps) => ipcRenderer.invoke("export-collection", type, beatmtaps),
    get_collection_data: (location, type) => ipcRenderer.invoke("get-collection-data", location, type),
    get_collections: (force) => ipcRenderer.invoke("get-collections", force),
    filter_beatmaps: (...args) => ipcRenderer.invoke("filter-beatmaps", ...args),
    update_collections: (data) => ipcRenderer.invoke("update-collections", data),
    export_beatmaps: (beatmaps) => ipcRenderer.invoke("export-beatmaps", beatmaps),
    export_beatmap: (beatmap) => ipcRenderer.invoke("export-beatmap", beatmap)
});

contextBridge.exposeInMainWorld("indexer", {
    on_process: (callback) => {
        ipcRenderer.on("process", (_, data) => callback(data));
    },
    on_process_update: (callback) => {
        ipcRenderer.on("process-update", (_, data) => callback(data));
    }
});

contextBridge.exposeInMainWorld("downloader", {
    add: (obj) => ipcRenderer.invoke("add-download", obj),
    add_mirror: (obj) => ipcRenderer.invoke("add-mirror", obj),
    set_token: (token) => ipcRenderer.invoke("set-token", token),
    start: (name) => ipcRenderer.invoke("start-download", name),
    single: (beatmap) => ipcRenderer.invoke("single-download", beatmap),
    stop: (name) => ipcRenderer.invoke("stop-download", name),
    resume: (name) => ipcRenderer.invoke("resume-download", name),
    all: () => ipcRenderer.invoke("get-downloads"),
    remove: (name) => ipcRenderer.invoke("remove-download", name),
    remove_mirror: (name) => ipcRenderer.invoke("remove-mirror", name),
    on_downloads_update: (callback) => {
        ipcRenderer.on("downloads-update", (_, data) => callback(data));
    },
    on_export_update: (callback) => {
        ipcRenderer.on("export-update", (_, data) => callback(data));
    }
});

contextBridge.exposeInMainWorld("electronAPI", {
    open_folder: (url) => shell.openPath(url)
});

contextBridge.exposeInMainWorld("shell", {
    open: (url, options) => shell.openExternal(url, options)
});

contextBridge.exposeInMainWorld("extra", {
    is_dev_mode: () => ipcRenderer.invoke("is-dev-mode"),
    fetch_stats: (url, cookies) => ipcRenderer.invoke("fetch-stats", url, cookies),
    create_auth: (url, end) => ipcRenderer.invoke("create-auth", url, end),
    dialog: (options) => ipcRenderer.invoke("dialog", options),
    is_maximized: () => ipcRenderer.invoke("is_maximized"),
    maximize: () => ipcRenderer.invoke("maximize"),
    minimize: () => ipcRenderer.invoke("minimize"),
    close: () => ipcRenderer.invoke("close"),
    check_folder_permissions: (folder) => check_folder_permissions(folder),
    fetch: (options) => ipcRenderer.invoke("http-request", options),
    dev_tools: () => ipcRenderer.invoke("dev-tools")
});

contextBridge.exposeInMainWorld("path", {
    resolve: (a) => path.resolve(a),
    normalize: (a) => path.normalize(a)
});
