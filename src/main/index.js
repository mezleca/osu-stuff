import { app, shell, BrowserWindow, ipcMain, dialog, protocol, session, net } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";

import icon from "../../resources/icon.png?asset";

// testing
const additionalArguments = [
	"--enable-smooth-scrolling",
	"--enable-zero-copy",
	"--enable-gpu-rasterization",
	"--disable-features=TranslateUI",
	"--disable-ipc-flooding-protection"
];

// protocol to get images / stuff from osu!
protocol.registerSchemesAsPrivileged([
	{
		scheme: "media",
		privileges: {
			secure: true,
			stream: true,
			supportFetchAPI: true,
			bypassCSP: true
		}
	}
]);

// fuck
ipcMain.handle("http-request", async (event, options) => {
	try {
		const response = await fetch(options.url, {
			method: options.method || "GET",
			headers: options.headers || {},
			body: options.body ? JSON.stringify(options.body) : undefined
		});

		let data = null;
		const type = response.headers.get("content-type");

		if (type && type.includes("application/json")) {
			data = await response.json();
		} else if (type && type.includes("text")) {
			data = await response.text();
		} else {
			const buffer = await response.arrayBuffer();
			data = Buffer.from(buffer);
		}

		return { ok: true, status: response.status, data };
	} catch (err) {
		return { ok: false, error: err.message };
	}
});

function createWindow() {
	// create the browser window.
	const mainWindow = new BrowserWindow({
		width: 1100,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		show: false,
		frame: false,
		autoHideMenuBar: true,
		...(process.platform == "linux" ? { icon } : {}),
		webPreferences: {
			additionalArguments,
			preload: join(__dirname, "../preload/index.js"),
			sandbox: false,
			nodeIntegration: true,
			contextIsolation: true,
			enableRemoteModule: true,
			webSecurity: true
		}
	});

	// window controls
	ipcMain.handle("is_maximized", () => mainWindow.isMaximized());
	ipcMain.handle("maximize", () => (mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()));
	ipcMain.handle("minimize", () => mainWindow.minimize());
	ipcMain.handle("close", () => app.quit());

	// file dialog
	ipcMain.handle("dialog", async (_, options = {}) => {
		try {
			const result = await dialog.showOpenDialog(mainWindow, { ...options });
			return result;
		} catch (error) {
			console.error("failed to create dialog:", error);
			return { canceled: true };
		}
	});

	mainWindow.on("ready-to-show", mainWindow.show);

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url);
		return { action: "deny" };
	});

	// HMR for renderer base on electron-vite cli.
	// Load the remote URL for development or the local html file for production.
	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
		mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
	// Set app user model id for windows
	electronApp.setAppUserModelId("com.electron");

	// Default open or close DevTools by F12 in development
	// and ignore CommandOrControl + R in production.
	// see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
	app.on("browser-window-created", (_, window) => {
		optimizer.watchWindowShortcuts(window);
	});

	// dont remember why i use this but it seems to cause some problems without it
	session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
		callback({ requestHeaders: { ...details.requestHeaders } });
	});

	// image protocol so electron dont freak out
	protocol.handle("media", (req) => {
		const path_to_media = decodeURIComponent(req.url.replace("media://", ""));
		return net.fetch(`file://${path_to_media}`);
	});

	createWindow();

	app.on("activate", function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length == 0) createWindow();
	});
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform != "darwin") {
		app.quit();
	}
});
