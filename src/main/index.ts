import { app, shell, dialog, protocol, net, Privileges } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { config } from "./database/config";
import { mirrors } from "./database/mirrors";
import { get_window, get_app_path } from "./database/utils";
import { fetch_manager, media_manager } from "./fetch";
import { handle_ipc } from "./ipc";
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
    add_beatmaps_to_collection,
    should_update,
    is_initialized,
    get_beatmap_files
} from "./osu/drivers/driver";
import { auth, v2 } from "osu-api-extended";
import { beatmap_downloader } from "./osu/downloader";
import { beatmap_exporter } from "./osu/exporter";
import { read_legacy_collection, read_legacy_db, write_legacy_collection } from "./binary/stable";
import { read_osdb, write_osdb } from "./binary/osdb";
import { is_dev_mode } from "./env";
import { updater } from "./update";
import { beatmap_processor } from "./database/processor";

import fs from "fs";
import path from "path";

const app_resource_root = app.isPackaged ? process.resourcesPath : app.getAppPath();
const resource_folder = path.join(app_resource_root, "resources");
const icon_path = path.join(resource_folder, "icon.png");

const file_privileges: Privileges = {
    secure: true,
    stream: true,
    supportFetchAPI: true,
    bypassCSP: true
};

protocol.registerSchemesAsPrivileged([
    {
        scheme: "media",
        privileges: file_privileges
    },
    {
        scheme: "resources",
        privileges: file_privileges
    }
]);

const additionalArguments = ["--disable-renderer-backgrounding", "--disable-ipc-flooding-protection", "--disable-background-timer-throttling"];

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
        icon: icon_path,
        webPreferences: {
            additionalArguments,
            preload: path.resolve(app.getAppPath(), "out/preload/index.js"),
            sandbox: false,
            nodeIntegration: true,
            contextIsolation: true,
            webSecurity: true
        }
    });

    await config.setup_default_paths();
    beatmap_processor.set_window(mainWindow);
    beatmap_downloader.initialize();

    // env
    handle_ipc("env:dev_mode", is_dev_mode);

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
    handle_ipc("driver:is_initialized", (_, args) => is_initialized(...args));
    handle_ipc("driver:should_update", (_, args) => should_update(...args));
    handle_ipc("driver:get_player_name", (_, args) => get_player_name(...args));
    handle_ipc("driver:add_collection", (_, args) => add_collection(...args));
    handle_ipc("driver:rename_collection", (_, args) => rename_collection(...args));
    handle_ipc("driver:delete_collection", (_, args) => delete_collection(...args));
    handle_ipc("driver:get_collection", (_, args) => get_collection(...args));
    handle_ipc("driver:get_collections", (_, args) => get_collections(...args));
    handle_ipc("driver:update_collection", (_, args) => update_collection(...args));
    handle_ipc("driver:add_beatmaps_to_collection", (_, args) => add_beatmaps_to_collection(...args));
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
    handle_ipc("driver:get_missing_beatmaps", (_, args) => get_missing_beatmaps(...args));
    handle_ipc("driver:get_beatmap_files", (_, args) => get_beatmap_files(...args));
    handle_ipc("driver:fetch_beatmaps", (_, args) => fetch_beatmaps(...args));
    handle_ipc("driver:fetch_beatmapsets", (_, args) => fetch_beatmapsets(...args));

    // osu-extended-api
    handle_ipc("web:authenticate", (_, args) => {
        const params = args[0];
        if (params.type == "v2") {
            params.cachedTokenPath = path.resolve(get_app_path(), "osu_token.json");
        }
        return auth.login(params);
    });

    handle_ipc("web:get_beatmap", (_, args) => v2.beatmaps.lookup(args[0]));
    handle_ipc("web:get_beatmapset", (_, args) => v2.beatmaps.lookup(args[0]));
    handle_ipc("web:search", (_, args) => v2.search(args[0]));
    handle_ipc("web:players_lookup", (_, args) => v2.users.lookup(args[0]));
    handle_ipc("web:users_details", (_, args) => v2.users.details(args[0]));
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

    // exporter
    handle_ipc("exporter:start", (_, args) => beatmap_exporter.start(args[0]));
    handle_ipc("exporter:cancel", (_) => beatmap_exporter.cancel());
    handle_ipc("exporter:state", (_) => beatmap_exporter.get_state());

    // reader (stable)
    handle_ipc("reader:read_legacy_collection", (_, args) => read_legacy_collection(args[0]));
    handle_ipc("reader:read_legacy_db", (_, args) => read_legacy_db(args[0]));
    handle_ipc("reader:write_legacy_collection", (_, args) => write_legacy_collection(args[0]));

    // reader (osdb)
    handle_ipc("reader:read_osdb", (_, args) => read_osdb(args[0]));
    handle_ipc("reader:write_osdb", (_, args) => write_osdb(args[0]));

    // media
    handle_ipc("media:get", (_, args) => media_manager.get(args[0]));
    handle_ipc("media:get_buffer", (_, args) => {
        try {
            const file_path = args[0];
            const app_config = config.get();
            const allowed_paths = [app_config.stable_songs_path, app_config.lazer_path].filter(Boolean);
            const is_allowed = allowed_paths.some((p) => file_path.startsWith(p));

            if (!is_allowed) {
                console.error(`blocking unauthorized access to: ${file_path}`);
                return { success: false, reason: "unauthorized" };
            }

            const buffer = fs.readFileSync(file_path);
            return { success: true, data: new Uint8Array(buffer) };
        } catch (err) {
            console.error(`media:get_buffer error for ${args[0]}:`, err);
            return { success: false, reason: String(err) };
        }
    });
    handle_ipc("resources:get_hitsounds", () => {
        try {
            const hitsounds_path = path.join(resource_folder, "hitsounds");

            if (!fs.existsSync(hitsounds_path)) {
                return [];
            }

            return fs
                .readdirSync(hitsounds_path, { withFileTypes: true })
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name)
                .filter((name) => {
                    const lower_name = name.toLowerCase();
                    return lower_name.endsWith(".wav") || lower_name.endsWith(".mp3") || lower_name.endsWith(".ogg");
                })
                .sort((a, b) => a.localeCompare(b));
        } catch (error) {
            console.error("failed to read hitsounds from resources:", error);
            return [];
        }
    });

    // initialize auto updater
    updater.initialize();

    mainWindow.on("ready-to-show", mainWindow.show);

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });

    // auto open devtools in dev mode
    if (is_dev_mode()) {
        mainWindow.webContents.openDevTools();
    }

    const renderer_url = process.env["ELECTRON_RENDERER_URL"];

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is_dev_mode() && renderer_url) {
        mainWindow.loadURL(renderer_url);
    } else {
        mainWindow.loadFile(path.resolve(app.getAppPath(), "out/renderer/index.html"));
    }
}

const normalize_protocol_path = (original: string, protocol: string): string => {
    let location = decodeURIComponent(original.replace(`${protocol}://`, ""));

    if (process.platform == "win32") {
        location = location.replace(/\\/g, "/");
        if (!location.includes(":/")) location = location.replace(/^([A-Z])\//, "$1:/");
    }

    // encode again because some paths will prob break without this
    location = encodeURI(location).replace(/#/g, "%23");

    return location;
};

const is_subdir = (parent: string, child: string): boolean => {
    const resolved_parent = path.resolve(parent);
    const resolved_child = path.resolve(child);
    return resolved_child.startsWith(resolved_parent + path.sep) || resolved_child == resolved_parent;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    // protocol to return files from fs
    protocol.handle("media", (req) => {
        try {
            const normalized = normalize_protocol_path(req.url, "media");
            return net.fetch(process.platform == "win32" ? `file:///${normalized}` : `file://${normalized}`);
        } catch (err) {
            console.error("protocol error:", err);
            return new Response("not found", { status: 404 });
        }
    });

    // protocol to reutnr files from resources
    protocol.handle("resources", (req) => {
        try {
            const normalized = normalize_protocol_path(req.url, "resources");
            const asset_location = path.join(resource_folder, normalized);

            if (!is_subdir(resource_folder, asset_location)) {
                throw Error(`${asset_location} is not a subdir of: ${resource_folder}`);
            }

            return net.fetch(process.platform == "win32" ? `file:///${asset_location}` : `file://${asset_location}`);
        } catch (err) {
            console.error("protocol error:", err);
            return new Response("not found", { status: 404 });
        }
    });

    // Set app user model id for windows
    electronApp.setAppUserModelId("com.osu-stuff");

    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
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
