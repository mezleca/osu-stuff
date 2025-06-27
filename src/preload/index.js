const os = require("os");
const path = require("path");
const zlib = require("zlib");

const { contextBridge, ipcRenderer, shell } = require("electron");

import { check_folder_permissions, get_linux_path } from "./utils/validator.js";
import { database } from "./database/indexed.js";
import { realm } from "./database/realm.js";
import { stuff_fs } from "./filesystem/index.js";
import { zip } from "./zip/index.js";

contextBridge.exposeInMainWorld("database", database);
contextBridge.exposeInMainWorld("realmj", realm);
contextBridge.exposeInMainWorld("fs", stuff_fs);
contextBridge.exposeInMainWorld("JSZip", zip);

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
		ipcRenderer.on("token-update", (_, data) => {
			callback(data);
		});
	},
	on_path_update: (callback) => {
		ipcRenderer.on("path-update", (_, data) => {
			callback(data);
		});
	},
	on_download_progress: (callback) => {
		ipcRenderer.on("download-progress", (_, data) => {
			callback(data);
		});
	}
});

contextBridge.exposeInMainWorld("electronAPI", {
	open_folder: (url) => shell.openPath(url)
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
	dialog: (options) => ipcRenderer.invoke("dialog", options),
	select_file: (options) => ipcRenderer.invoke("select-file", options),
	is_maximized: () => ipcRenderer.invoke("is_maximized"),
	maximize: () => ipcRenderer.invoke("maximize"),
	minimize: () => ipcRenderer.invoke("minimize"),
	close: () => ipcRenderer.invoke("close"),
	check_folder_permissions: (folder) => check_folder_permissions(folder),
	fetch: (options) => ipcRenderer.invoke("http-request", options),
	homedir: os.homedir()
});
