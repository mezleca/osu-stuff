import { app, shell, ipcMain, dialog, protocol, session, net } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { config } from "./database/config";
import { mirrors } from "./database/mirrors";
import { get_window } from "./database/utils";
import { fetch_manager } from "./fetch";
import { handle_ipc } from "./ipc";

import path from "path";

// @ts-ignore
import icon from "../../resources/icon.png?asset";
import {
    add_beatmap,
    add_collection,
    delete_beatmap,
    delete_collection,
    export_beatmapset,
    export_collections,
    fetch_beatmaps,
    fetch_beatmapsets,
    get_beatmap_by_id,
    get_beatmap_by_md5,
    get_beatmapset,
    get_beatmaps,
    get_beatmapsets,
    get_collection,
    get_collections,
    get_missing_beatmaps,
    get_player_name,
    has_beatmap,
    has_beatmapset,
    has_beatmapsets,
    initialize_driver,
    rename_collection,
    search_beatmaps,
    search_beatmapsets,
    update_collection,
    get_actions,
    remove_action
} from "./database/drivers/driver";
import { auth, v2 } from "osu-api-extended";
import { beatmap_downloader } from "./beatmaps/downloader";
import { read_legacy_collection, read_legacy_db, write_legacy_collection } from "./binary/stable";
import { read_osdb, write_osdb } from "./binary/osdb";
import { is_dev_mode } from "./utils";

const additionalArguments = [
    "--enable-smooth-scrolling",
    "--enable-zero-copy",
    "--enable-gpu-rasterization", // improved animations on virtual list (not by much tbh)
    "--disable-features=TranslateUI",
    "--disable-renderer-backgrounding", // fixed some stuterring on my shitty ass pc (while playing heavy games)
    "--disable-ipc-flooding-protection",
    "--disable-background-timer-throttling" // improved animations on virtual list (not by much tbh)
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

    if (is_dev_mode) {
        const original_fn = ipcMain.handle.bind(ipcMain);
        ipcMain.handle = function (channel: string, handler: any) {
            return original_fn(channel, (event: any, ...args: any[]) => {
                console.log(`invoking ${channel}`);
                return handler(event, ...args);
            });
        };
    }

    await config.setup_default_paths();
    beatmap_downloader.initialize();

    // env
    handle_ipc("env:dev_mode", () => is_dev_mode);

    // window
    handle_ipc("window:state", () => (mainWindow.isMaximized() ? "maximized" : "minimized"));
    handle_ipc("window:minimize", () => mainWindow.minimize());
    handle_ipc("window:maximize", () => mainWindow.maximize());
    handle_ipc("window:unmaximize", () => mainWindow.unmaximize());
    handle_ipc("window:dialog", (_, args) => dialog.showOpenDialog(mainWindow, args[0]));
    handle_ipc("window:dev_tools", () => mainWindow.webContents.openDevTools());
    handle_ipc("window:close", () => app.quit());

    // shell
    handle_ipc("shell:open", (_, args) => shell.openExternal(args[0]));

    // fetch manager
    handle_ipc("fetch:get", (_, args) => fetch_manager.execute(args[0]));

    // config
    handle_ipc("config:get", () => config.get());
    handle_ipc("config:save", (_, args) => config.update(args[0]));
    handle_ipc("config:load", (_) => config.load());

    // mirrors
    handle_ipc("mirrors:get", () => mirrors.get());
    handle_ipc("mirrors:save", (_, args) => mirrors.update(args[0].name, args[0].url));
    handle_ipc("mirrors:delete", (_, args) => mirrors.delete(args[0].name));
    handle_ipc("mirrors:load", () => mirrors.load());

    // drivers
    handle_ipc("driver:initialize", (_, args) => initialize_driver(...args));
    handle_ipc("driver:get_player_name", (_, args) => get_player_name(...args));
    handle_ipc("driver:add_collection", (_, args) => add_collection(...args));
    handle_ipc("driver:rename_collection", (_, args) => rename_collection(...args));
    handle_ipc("driver:delete_collection", (_, args) => delete_collection(...args));
    handle_ipc("driver:get_collection", (_, args) => get_collection(...args));
    handle_ipc("driver:get_collections", (_, args) => get_collections(...args));
    handle_ipc("driver:update_collection", (_, args) => update_collection(...args));
    handle_ipc("driver:get_actions", (_, args) => get_actions(...args));
    handle_ipc("driver:remove_action", (_, args) => remove_action(...args));
    handle_ipc("driver:export_collections", (_, args) => export_collections(...args));
    handle_ipc("driver:add_beatmap", (_, args) => add_beatmap(...args));
    handle_ipc("driver:delete_beatmap", (_, args) => delete_beatmap(...args));
    handle_ipc("driver:has_beatmap", (_, args) => has_beatmap(...args));
    handle_ipc("driver:has_beatmapset", (_, args) => has_beatmapset(...args));
    handle_ipc("driver:has_beatmapsets", (_, args) => has_beatmapsets(...args));
    handle_ipc("driver:get_beatmap_by_md5", (_, args) => get_beatmap_by_md5(...args));
    handle_ipc("driver:get_beatmap_by_id", (_, args) => get_beatmap_by_id(...args));
    handle_ipc("driver:get_beatmapset", (_, args) => get_beatmapset(...args));
    handle_ipc("driver:export_beatmapset", (_, args) => export_beatmapset(...args));
    handle_ipc("driver:search_beatmaps", (_, args) => search_beatmaps(...args));
    handle_ipc("driver:search_beatmapsets", (_, args) => search_beatmapsets(...args));
    handle_ipc("driver:get_beatmaps", (_, args) => get_beatmaps(...args));
    handle_ipc("driver:get_beatmapsets", (_, args) => get_beatmapsets(...args));
    handle_ipc("driver:get_missing_beatmaps", (_, args) => get_missing_beatmaps(...args));
    handle_ipc("driver:fetch_beatmaps", (_, args) => fetch_beatmaps(...args));
    handle_ipc("driver:fetch_beatmapsets", (_, args) => fetch_beatmapsets(...args));

    // osu-extended-api
    handle_ipc("web:authenticate", (_, args) => auth.login(args[0]));
    handle_ipc("web:get_beatmap", (_, args) => v2.beatmaps.lookup(args[0]));
    handle_ipc("web:get_beatmapset", (_, args) => v2.beatmaps.lookup(args[0]));
    handle_ipc("web:search", (_, args) => v2.search(args[0]));
    handle_ipc("web:players_lookup", (_, args) => v2.users.lookup(args[0]));
    handle_ipc("web:user_beatmaps", (_, args) => v2.users.beatmaps(args[0]));
    handle_ipc("web:score_list_leaderboard", (_, args) => v2.scores.list(args[0]));
    handle_ipc("web:score_list_user_best", (_, args) => v2.scores.list(args[0]));
    handle_ipc("web:score_list_user_firsts", (_, args) => v2.scores.list(args[0]));

    // downloader
    handle_ipc("downloader:add", (_, params) => beatmap_downloader.add_to_queue(...params));
    handle_ipc("downloader:single", (_, params) => beatmap_downloader.add_single(...params));
    handle_ipc("downloader:pause", (_, params) => beatmap_downloader.pause(...params));
    handle_ipc("downloader:resume", (_, params) => beatmap_downloader.resume(...params));
    handle_ipc("downloader:get", (_) => beatmap_downloader.get_queue());
    handle_ipc("downloader:remove", (_, params) => beatmap_downloader.remove_from_queue(...params));

    // reader (stable)
    handle_ipc("reader:read_legacy_collection", (_, args) => read_legacy_collection(args[0]));
    handle_ipc("reader:read_legacy_db", (_, args) => read_legacy_db(args[0]));
    handle_ipc("reader:write_legacy_collection", (_, args) => write_legacy_collection(args[0]));

    // reader (osdb)
    handle_ipc("reader:read_osdb", (_, args) => read_osdb(args[0]));
    handle_ipc("reader:write_osdb", (_, args) => write_osdb(args[0]));

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
