import { app, shell, BrowserWindow, ipcMain, dialog, protocol, session, net } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { config } from "./database/config";
import { mirrors } from "./database/mirrors";
import { beatmap_processor } from "./database/processor";

import path from "path";
// @ts-ignore
import icon from "../../resources/icon.png?asset";
import { get_window } from "./database/utils";

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

const is_dev_mode = process.env["IS_DEV"] && process.env["ELECTRON_RENDERER_URL"];

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

async function createWindow() {
    // create the browser window.
    const mainWindow = get_window("main", {
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
            webSecurity: true
        }
    });

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
    }

    config.initialize();
    mirrors.initialize();
    beatmap_processor.initialize();

    // downloader.main(ipcMain, mainWindow);

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

    const renderer_url = process.env["ELECTRON_RENDERER_URL"];

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is_dev_mode && renderer_url) {
        mainWindow.loadURL(renderer_url);
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

    // TOFIX: too dangerous
    protocol.handle("media", (req) => {
        try {
            let location = decodeURI(req.url.replace("media://", ""));

            // stupid windows needs file:/// and C:/ instead of C/
            if (process.platform == "win32" && !location.includes(":/")) {
                location = location.replace(/^([A-Z])\//, "$1:/");
            }

            return net.fetch(process.platform == "win32" ? `file:///${location}` : `file://${location}`);
        } catch (err) {
            console.error("protocol error:", err);
            return new Response("not found", { status: 404 });
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
