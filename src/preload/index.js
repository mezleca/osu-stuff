const os = require("os");
const path = require("path");
const zlib = require("zlib");

const { contextBridge, ipcRenderer, shell } = require('electron');

import { check_folder_permissions, get_linux_path } from "./utils/validator.js";
import { database } from "./database/indexed.js";
import { realm } from "./database/realm.js";
import { stuff_fs } from "./filesystem/index.js";
import { zip } from "./zip/index.js";

contextBridge.exposeInMainWorld("database", database);
contextBridge.exposeInMainWorld("realmjs", realm);
contextBridge.exposeInMainWorld("fs", stuff_fs);
contextBridge.exposeInMainWorld("JSZip", zip);;

contextBridge.exposeInMainWorld("electronAPI", {
    update_mirrors: (list) => ipcRenderer.invoke("update-mirrors", list),
    update_path: (_path) => ipcRenderer.invoke("update-path", _path),
    update_token: (token) => ipcRenderer.invoke("update-token", token),
    create_download: (data) => ipcRenderer.invoke("create-download", data),
    stop_download: (id) => ipcRenderer.invoke("stop-download", id),
    single_map: (hash) => ipcRenderer.invoke("single-map", hash),
    is_downloading: () => ipcRenderer.invoke("is-downloading"),
    get_queue: () => ipcRenderer.invoke("get-queue"),
    open_folder: (url) => shell.openPath(url),
    on_download_create: (callback) => {
        ipcRenderer.on("download-create", (_, data) => callback(data));
    },
    on_progress_update: (callback) => {
        ipcRenderer.on("progress-update", (_, data) => callback(data));
    },
    on_progress_end: (callback) => {
        ipcRenderer.on("progress-end", (_, data) => callback(data));
    }
});

contextBridge.exposeInMainWorld("path", {
    basename: (_path, ext) => path.basename(_path, ext),
    dirname: (_path) => path.dirname(_path),
    extname: (_path) => path.extname(_path),
    format: (pathObject) => path.format(pathObject),
    isAbsolute: (_path) => path.isAbsolute(_path),
    join: (...paths) => path.join(...paths),
    normalize: (_path) => path.normalize(_path),
    parse: (_path) => path.parse(_path),
    relative: (from, to) => path.relative(from, to),
    resolve: (...paths) => path.resolve(...paths),
    get_linux_path: () => get_linux_path()
});

contextBridge.exposeInMainWorld("zlib", {
    deflateSync: (buffer, options) => zlib.deflateSync(buffer, options),
    inflateSync: (buffer, options) => zlib.inflateSync(buffer, options),
    gzipSync: (buffer, options) => zlib.gzipSync(buffer, options),
    gunzipSync: (buffer, options) => zlib.gunzipSync(buffer, options),
    constants: zlib.constants
});

contextBridge.exposeInMainWorld("shell", {
    openExternal: (url, options) => shell.openExternal(url, options)
});

contextBridge.exposeInMainWorld("process", {
    platform: process.platform,
    env: process.env
});

contextBridge.exposeInMainWorld("extra", {
    fetch_stats: (url, cookies) => ipcRenderer.invoke("fetch-stats", url, cookies),
    create_auth: (url, end) => ipcRenderer.invoke("create-auth", url, end),
    create_dialog: (options) => ipcRenderer.invoke("create-dialog", options),
    select_file: (options) => ipcRenderer.invoke("select-file", options), 
    maximize_window: () => ipcRenderer.invoke("maximize"),
    minimize_window: () => ipcRenderer.invoke("minimize"),
    close_window: () => ipcRenderer.invoke("close"),
    check_folder_permissions: (folder) => check_folder_permissions(folder),
    homedir: os.homedir(),
});
