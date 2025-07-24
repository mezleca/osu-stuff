import { app, shell, BrowserWindow, ipcMain, dialog, protocol, session, net } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { initialize_config, config, update_config_database } from "./database/config";
import { initialize_indexer } from "./database/indexer";
import { initialize_mirrors } from "./database/mirrors";
import { filter_beatmaps, get_beatmap_data, get_beatmaps_from_database, get_missing_beatmaps } from "./beatmaps/beatmaps";
import { get_collections_from_database, update_collections } from "./beatmaps/collections";

import icon from "../../resources/icon.png?asset";
import { downloader } from "./beatmaps/downloader";

// testing
const additionalArguments = [
    "--enable-smooth-scrolling",
    "--enable-zero-copy",
    "--enable-gpu-rasterization",
    "--disable-features=TranslateUI",
    "--disable-ipc-flooding-protection",
    "--no-sandbox",
    "--disable-background-timer-throttling"
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
        console.log(err.errors);
        return { ok: false, error: err.message };
    }
});

async function createWindow() {
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

    // config related stuff
    ipcMain.handle("get-config", () => config);
    ipcMain.handle("update-config", (_, values) => update_config_database(values));

    // osu related stuff
    ipcMain.handle("get-beatmaps", (_, force) => get_beatmaps_from_database(force));
    ipcMain.handle("get-collections", () => get_collections_from_database());
    ipcMain.handle("filter-beatmaps", (_, hashes, query, extra) => filter_beatmaps(hashes, query, extra));
    ipcMain.handle("get-beatmap", (_, data, is_unique_id) => get_beatmap_data(data, "", is_unique_id));
    ipcMain.handle("missing-beatmaps", (_, data) => get_missing_beatmaps(data));
    ipcMain.handle("update-collections", (_, data) => update_collections(data));

    await initialize_config();
    initialize_mirrors();

    downloader.main(ipcMain, mainWindow);

    // indexer will be used to process extra beatmap information and save into a sqlite database
    // beatmap location because yes and song duration since osu! only returns beatmap length (unless im stupid)
    initialize_indexer(mainWindow);

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
app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId("com.osu-stuff");

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

    // @TODO: this is dangerous asf LOL i can literally get any file using ts
    protocol.handle("media", (req) => {
        try {
            const location = decodeURI(req.url.replace("media://", ""));
            return net.fetch(`file://${location}`);
        } catch (err) {
            // ignore
        }
    });

    // initialize electron window
    createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform != "darwin") {
        app.quit();
    }
});
