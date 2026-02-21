import { app, shell, dialog, protocol, net, Privileges } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { config } from "./database/config";
import { mirrors } from "./database/mirrors";
import { get_window, get_app_path, is_audio } from "./utils";
import { fetch_manager } from "./fetch";
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
import { OpenDevToolsOptions } from "electron/utility";

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

const dev_tools_options: OpenDevToolsOptions = {
    mode: "detach"
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
    handle_ipc("window:dialog", (_, options) => dialog.showOpenDialog(mainWindow, options));
    handle_ipc("window:dev_tools", () => mainWindow.webContents.openDevTools(dev_tools_options));
    handle_ipc("window:close", () => app.quit());

    // shell
    handle_ipc("shell:open", (_, target_url) => shell.openExternal(target_url));
    handle_ipc("shell:open_path", (_, target_path) => shell.openPath(target_path));

    // fetch manager
    handle_ipc("fetch:get", (_, options) => fetch_manager.execute(options));

    // config
    handle_ipc("config:get", () => config.get());
    handle_ipc("config:save", (_, data) => config.update(data));
    handle_ipc("config:load", (_) => config.load());

    // mirrors
    handle_ipc("mirrors:get", () => mirrors.get());
    handle_ipc("mirrors:save", (_, mirror) => mirrors.update(mirror.name, mirror.url));
    handle_ipc("mirrors:delete", (_, data) => mirrors.delete(data.name));
    handle_ipc("mirrors:load", () => mirrors.load());

    // drivers
    handle_ipc("driver:initialize", (_, force, driver) => initialize_driver(force, driver));
    handle_ipc("driver:is_initialized", (_, driver) => is_initialized(driver));
    handle_ipc("driver:should_update", (_, driver) => should_update(driver));
    handle_ipc("driver:get_player_name", (_, driver) => get_player_name(driver));
    handle_ipc("driver:add_collection", (_, name, beatmaps, driver) => add_collection(name, beatmaps, driver));
    handle_ipc("driver:rename_collection", (_, old_name, new_name, driver) => rename_collection(old_name, new_name, driver));
    handle_ipc("driver:delete_collection", (_, name, driver) => delete_collection(name, driver));
    handle_ipc("driver:get_collection", (_, name, driver) => get_collection(name, driver));
    handle_ipc("driver:get_collections", (_, driver) => get_collections(driver));
    handle_ipc("driver:update_collection", (_, driver) => update_collection(driver));
    handle_ipc("driver:add_beatmaps_to_collection", (_, name, hashes, driver) => add_beatmaps_to_collection(name, hashes, driver));
    handle_ipc("driver:export_collections", (_, collections, type, driver) => export_collections(collections, type, driver));
    handle_ipc("driver:add_beatmap", (_, beatmap, driver) => add_beatmap(beatmap, driver));
    handle_ipc("driver:delete_beatmap", (_, options, driver) => delete_beatmap(options, driver));
    handle_ipc("driver:has_beatmap", (_, md5, driver) => has_beatmap(md5, driver));
    handle_ipc("driver:has_beatmapset", (_, id, driver) => has_beatmapset(id, driver));
    handle_ipc("driver:has_beatmapsets", (_, ids, driver) => has_beatmapsets(ids, driver));
    handle_ipc("driver:get_beatmap_by_md5", (_, md5, driver) => get_beatmap_by_md5(md5, driver));
    handle_ipc("driver:get_beatmap_by_id", (_, id, driver) => get_beatmap_by_id(id, driver));
    handle_ipc("driver:get_beatmapset", (_, id, driver) => get_beatmapset(id, driver));
    handle_ipc("driver:export_beatmapset", (_, id, driver) => export_beatmapset(id, driver));
    handle_ipc("driver:search_beatmaps", (_, options, target, driver) => search_beatmaps(options, target, driver));
    handle_ipc("driver:search_beatmapsets", (_, options, driver) => search_beatmapsets(options, driver));
    handle_ipc("driver:get_missing_beatmaps", (_, name, driver) => get_missing_beatmaps(name, driver));
    handle_ipc("driver:get_beatmap_files", (_, md5, driver) => get_beatmap_files(md5, driver));
    handle_ipc("driver:fetch_beatmaps", (_, hashes, driver) => fetch_beatmaps(hashes, driver));
    handle_ipc("driver:fetch_beatmapsets", (_, ids, driver) => fetch_beatmapsets(ids, driver));

    // osu-extended-api
    handle_ipc("web:authenticate", (_, params) => {
        if (params.type == "v2") {
            params.cached_token_path = path.resolve(get_app_path(), "osu_token.json");
        }
        return auth.login(params);
    });

    handle_ipc("web:get_beatmap", (_, options) => v2.beatmaps.lookup(options));
    handle_ipc("web:get_beatmapset", (_, options) => v2.beatmaps.lookup(options));
    handle_ipc("web:search", (_, options) => v2.search(options));
    handle_ipc("web:players_lookup", (_, options) => v2.users.lookup(options));
    handle_ipc("web:users_details", (_, options) => v2.users.details(options));
    handle_ipc("web:user_beatmaps", (_, options) => v2.users.beatmaps(options));
    handle_ipc("web:score_list_leaderboard", (_, options) => v2.scores.list(options));
    handle_ipc("web:score_list_user_best", (_, options) => v2.scores.list(options));
    handle_ipc("web:score_list_user_firsts", (_, options) => v2.scores.list(options));

    // downloader
    handle_ipc("downloader:add", (_, data) => beatmap_downloader.add_to_queue(data));
    handle_ipc("downloader:single", (_, data) => beatmap_downloader.add_single(data));
    handle_ipc("downloader:pause", (_, id) => beatmap_downloader.pause(id));
    handle_ipc("downloader:resume", (_, id) => beatmap_downloader.resume(id));
    handle_ipc("downloader:get", (_) => beatmap_downloader.get_queue());
    handle_ipc("downloader:remove", (_, id) => beatmap_downloader.remove_from_queue(id));

    // exporter
    handle_ipc("exporter:start", (_, collections_name) => beatmap_exporter.start(collections_name));
    handle_ipc("exporter:cancel", (_) => beatmap_exporter.cancel());
    handle_ipc("exporter:state", (_) => beatmap_exporter.get_state());

    // reader (stable)
    handle_ipc("reader:read_legacy_collection", (_, location) => read_legacy_collection(location));
    handle_ipc("reader:read_legacy_db", (_, location) => read_legacy_db(location));
    handle_ipc("reader:write_legacy_collection", (_, data) => write_legacy_collection(data));

    // reader (osdb)
    handle_ipc("reader:read_osdb", (_, location) => read_osdb(location));
    handle_ipc("reader:write_osdb", (_, data) => write_osdb(data));

    handle_ipc("resources:get_hitsounds", () => {
        try {
            const hitsounds_path = path.join(resource_folder, "hitsounds");

            if (!fs.existsSync(hitsounds_path)) {
                return [];
            }

            const entries = fs.readdirSync(hitsounds_path, { withFileTypes: true }).filter((entry) => entry.isFile());

            const valid: string[] = [];

            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i].name;

                if (is_audio(entry)) {
                    valid.push(entry);
                }
            }

            return valid;
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
        mainWindow.webContents.openDevTools(dev_tools_options);
    }

    const renderer_url = process.env["ELECTRON_RENDERER_URL"];

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

app.whenReady().then(async () => {
    // protocol to return files from fs
    protocol.handle("media", async (req) => {
        try {
            const normalized = normalize_protocol_path(req.url, "media");
            return net.fetch(process.platform == "win32" ? `file:///${normalized}` : `file://${normalized}`, {
                headers: {
                    "Content-Type": "image/webp",
                    "Cache-Control": "max-age=3600"
                }
            });
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

app.on("window-all-closed", () => {
    if (process.platform != "darwin") {
        app.quit();
    }
});
