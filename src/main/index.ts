import { app, shell, dialog, protocol, net, Privileges } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { config } from "./database/config";
import { mirrors } from "./database/mirrors";
import { get_window, get_app_path } from "./utils";
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
    initialize_client,
    rename_collection,
    search_beatmaps,
    search_beatmapsets,
    update_collection,
    add_beatmaps_to_collection,
    should_update,
    is_client_initialized,
    get_beatmap_files
} from "./osu/clients/client";
import { auth, v2 } from "osu-api-extended";
import { beatmap_downloader } from "./osu/downloader";
import { beatmap_exporter } from "./osu/exporter";
import { read_legacy_collection, read_legacy_db, write_legacy_collection } from "./binary/stable";
import { read_osdb, write_osdb } from "./binary/osdb";
import { is_dev_mode } from "./env";
import { updater } from "./update";
import { beatmap_processor } from "./database/processor";
import { OpenDevToolsOptions } from "electron/utility";

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

    // clients
    handle_ipc("client:initialize", (_, force, client) => initialize_client(force, client));
    handle_ipc("client:is_initialized", (_, client) => is_client_initialized(client));
    handle_ipc("client:should_update", (_, client) => should_update(client));
    handle_ipc("client:get_player_name", (_, client) => get_player_name(client));
    handle_ipc("client:add_collection", (_, name, beatmaps, client) => add_collection(name, beatmaps, client));
    handle_ipc("client:rename_collection", (_, old_name, new_name, client) => rename_collection(old_name, new_name, client));
    handle_ipc("client:delete_collection", (_, name, client) => delete_collection(name, client));
    handle_ipc("client:get_collection", (_, name, client) => get_collection(name, client));
    handle_ipc("client:get_collections", (_, client) => get_collections(client));
    handle_ipc("client:update_collection", (_, client) => update_collection(client));
    handle_ipc("client:add_beatmaps_to_collection", (_, name, hashes, client) => add_beatmaps_to_collection(name, hashes, client));
    handle_ipc("client:export_collections", (_, collections, type, client) => export_collections(collections, type, client));
    handle_ipc("client:add_beatmap", (_, beatmap, client) => add_beatmap(beatmap, client));
    handle_ipc("client:delete_beatmap", (_, options, client) => delete_beatmap(options, client));
    handle_ipc("client:has_beatmap", (_, md5, client) => has_beatmap(md5, client));
    handle_ipc("client:has_beatmapset", (_, id, client) => has_beatmapset(id, client));
    handle_ipc("client:has_beatmapsets", (_, ids, client) => has_beatmapsets(ids, client));
    handle_ipc("client:get_beatmap_by_md5", (_, md5, client) => get_beatmap_by_md5(md5, client));
    handle_ipc("client:get_beatmap_by_id", (_, id, client) => get_beatmap_by_id(id, client));
    handle_ipc("client:get_beatmapset", (_, id, client) => get_beatmapset(id, client));
    handle_ipc("client:export_beatmapset", (_, id, client) => export_beatmapset(id, client));
    handle_ipc("client:search_beatmaps", (_, options, target, client) => search_beatmaps(options, target, client));
    handle_ipc("client:search_beatmapsets", (_, options, client) => search_beatmapsets(options, client));
    handle_ipc("client:get_missing_beatmaps", (_, name, client) => get_missing_beatmaps(name, client));
    handle_ipc("client:get_beatmap_files", (_, md5, client) => get_beatmap_files(md5, client));
    handle_ipc("client:fetch_beatmaps", (_, hashes, client) => fetch_beatmaps(hashes, client));
    handle_ipc("client:fetch_beatmapsets", (_, ids, client) => fetch_beatmapsets(ids, client));

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
