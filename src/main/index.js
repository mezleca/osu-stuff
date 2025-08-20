import { app, shell, BrowserWindow, ipcMain, dialog, protocol, session, net } from "electron";
import { downloader } from "./beatmaps/downloader";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { initialize_config, config, update_config_database } from "./database/config";
import { initialize_indexer } from "./database/indexer";
import { initialize_mirrors } from "./database/mirrors";
import {
    add_beatmap,
    filter_beatmaps,
    get_beatmap_by_md5,
    get_beatmap_by_set_id,
    get_beatmap_data,
    get_beatmaps_from_database,
    get_missing_beatmaps
} from "./beatmaps/beatmaps";
import { get_and_update_collections, update_collections, get_collection_data, export_collection } from "./beatmaps/collections";
import { FetchManager } from "./fetch";

import path from "path";
import icon from "../../resources/icon.png?asset";

// testing
const additionalArguments = [
    "--enable-smooth-scrolling",
    "--enable-zero-copy",
    "--enable-gpu-rasterization", // improved animations on virtual list (not by much tbh)
    "--disable-features=TranslateUI",
    "--disable-renderer-backgrounding", // fixed some stuterring on my shitty ass pc (while playing heavy games)
    "--disable-ipc-flooding-protection",
    "--disable-background-timer-throttling" // improved animations on virtual list (not by much tbh)
];

const is_dev_mode = is.dev && process.env["ELECTRON_RENDERER_URL"];

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

app.commandLine.appendSwitch("--max-old-space-size", "2048");
app.commandLine.appendSwitch("--expose-gc");

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
            preload: path.join(__dirname, "../preload/index.js"),
            sandbox: false,
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: true,
            webSecurity: true
        }
    });

    const fetch_manager = new FetchManager();
    const original_handle = ipcMain.handle.bind(ipcMain);

    if (is_dev_mode) {
        // override for debug
        ipcMain.handle = function (channel, handler) {
            console.log(`[debug] registered handler: ${channel}`);
            return original_handle(channel, async (...args) => {
                console.log(`[debug] received invoke for ${channel}`);
                const result = await handler(...args);
                return result;
            });
        };

        setInterval(async () => {
            const node_memory = await process.getProcessMemoryInfo();
            console.log(`[debug] using ${(node_memory.residentSet / 1024).toFixed(2)} mbs`);
        }, 2000);
    }

    // extra
    ipcMain.handle("dev-tools", () => mainWindow.webContents.openDevTools({ mode: "detach" }));

    // window controls
    ipcMain.handle("is_maximized", () => mainWindow.isMaximized());
    ipcMain.handle("maximize", () => (mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()));
    ipcMain.handle("minimize", () => mainWindow.minimize());
    ipcMain.handle("close", () => app.quit());

    // config related stuff
    ipcMain.handle("get-config", () => config);
    ipcMain.handle("update-config", (_, values) => update_config_database(values));

    // since we're using vite for dev, cors happen
    ipcMain.handle("http-request", async (_, options) => {
        return await fetch_manager.request(options);
    });

    // osu related stuff
    ipcMain.handle("add-beatmap", (_, hash, beatmap) => add_beatmap(hash, beatmap));
    ipcMain.handle("get-beatmaps", (_, force) => get_beatmaps_from_database(force));
    ipcMain.handle("get-collections", (_, force) => get_and_update_collections(force));
    ipcMain.handle("get-collection-data", (_, location, type) => get_collection_data(location, type));
    ipcMain.handle("export-collection", (_, collection, type) => export_collection(collection, type));
    ipcMain.handle("filter-beatmaps", (_, hashes, query, extra) => filter_beatmaps(hashes, query, extra));
    ipcMain.handle("get-beatmap", (_, data, is_unique_id) => get_beatmap_data(data, "", is_unique_id));
    ipcMain.handle("get-beatmap-by-id", (_, id) => get_beatmap_by_set_id(id));
    ipcMain.handle("get-beatmap-by-md5", (_, md5) => get_beatmap_by_md5(md5));
    ipcMain.handle("missing-beatmaps", (_, data) => get_missing_beatmaps(data));
    ipcMain.handle("update-collections", (_, data) => update_collections(data));
    ipcMain.handle("export-beatmaps", (_, beatmaps) => downloader.exportBeatmaps(beatmaps));
    ipcMain.handle("export-beatmap", (_, beatmap) => downloader.exportSingleBeatmap(beatmap));

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
    if (is_dev_mode) {
        mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
        mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
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
