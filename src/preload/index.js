const { contextBridge, ipcRenderer, shell } = require("electron");

import { check_folder_permissions } from "./utils/validator.js";
import { database } from "./database/indexed.js";
import { stuff_fs } from "./filesystem/index.js";

contextBridge.exposeInMainWorld("database", database);
contextBridge.exposeInMainWorld("fs", stuff_fs);

contextBridge.exposeInMainWorld("config", {
	get: () => ipcRenderer.invoke("get-config"),
	update: (values) => ipcRenderer.invoke("update-config", values)
});

contextBridge.exposeInMainWorld("osu", {
	get_beatmaps: () => ipcRenderer.invoke("get-beatmaps"),
	get_beatmap: (md5, query) => ipcRenderer.invoke("get-beatmap", md5, query),
	get_collections: () => ipcRenderer.invoke("get-collections"),
	filter_beatmaps: (...args) => ipcRenderer.invoke("filter-beatmaps", ...args)
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
	stop: () => ipcRenderer.invoke("stop-download"),
	all: () => ipcRenderer.invoke("get-downloads"),
	remove: (name) => ipcRenderer.invoke("remove-download", name),
	remove_mirror: (name) => ipcRenderer.invoke("remove-mirror", name),
	on_token_update: (callback) => {
		ipcRenderer.on("token-update", (_, data) => callback(data));
	},
	on_path_update: (callback) => {
		ipcRenderer.on("path-update", (_, data) => callback(data));
	},
	on_download_progress: (callback) => {
		ipcRenderer.on("download-progress", (_, data) => callback(data));
	}
});

contextBridge.exposeInMainWorld("electronAPI", {
	open_folder: (url) => shell.openPath(url)
});

contextBridge.exposeInMainWorld("shell", {
	openExternal: (url, options) => shell.openExternal(url, options)
});

contextBridge.exposeInMainWorld("extra", {
	fetch_stats: (url, cookies) => ipcRenderer.invoke("fetch-stats", url, cookies),
	create_auth: (url, end) => ipcRenderer.invoke("create-auth", url, end),
	dialog: (options) => ipcRenderer.invoke("dialog", options),
	select_file: (options) => ipcRenderer.invoke("select-file", options),
	is_maximized: () => ipcRenderer.invoke("is_maximized"),
	maximize: () => ipcRenderer.invoke("maximize"),
	minimize: () => ipcRenderer.invoke("minimize"),
	close: () => ipcRenderer.invoke("close"),
	check_folder_permissions: (folder) => check_folder_permissions(folder),
	fetch: (options) => ipcRenderer.invoke("http-request", options)
});
