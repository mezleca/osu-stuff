import path from "path";
import fs from "fs";

import { app, BrowserWindow, ipcMain, dialog, session, net, globalShortcut, Menu, protocol } from "electron";
import { fileURLToPath } from 'url';
import { init_downloader } from "./downloader.js";

Menu.setApplicationMenu(null);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dev_mode = process.env.STUFF_ENV == "dev";

const w = 1120, h = 840;
const min_w = 968, min_h = 720;

/** @type {BrowserWindow} */
let main_window = null;

const create_dialog = async (options = {}) => {
    try {
        return await dialog.showOpenDialog(main_window, { ...options });
    } catch (error) {
        console.error('failed to create dialog:', error);
        return { canceled: true };
    }
};

const get_icon_path = () => {
    
    const base_path = path.resolve("./build/icons");
    
    switch (process.platform) {
      case "win32":
        return path.join(base_path, "win/icon.ico");
      case "linux": 
      case "darwin":
      default: 
        return path.join(base_path, "png/256x256.png");
    }
};

protocol.registerSchemesAsPrivileged([{
    scheme: 'media',
    privileges: {
        secure: true,
        stream: true,
        supportFetchAPI: true,
        bypassCSP: true
    } 
}]);

const create_auth_window = (url, end) => {

    if (!url || !end) {
        console.log("missing url or end_url");
        return;
    }

    const auth_window = new BrowserWindow({
        width: w,
        height: h,
        fullscreenable: false,
        icon: get_icon_path(),
        webPreferences: {
            devTools: true,
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: true,
            webSecurity: true
        }
    });
  
    auth_window.loadURL(url);
    auth_window.show();

    return new Promise((resolve, reject) => {

        auth_window.webContents.on('did-navigate', async (event, new_url) => {

            const url = new URL(new_url);
            const cookies = await session.defaultSession.cookies.get({ url: url });
            const cookies_string = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

            if (url.toString() == end) {
                auth_window.close();
                return resolve(cookies_string);
            }
        });

        auth_window.on('closed', () => {
            reject(false);
        });
    });
};

const create_window = () => {

    main_window = new BrowserWindow(
    {
        width: w,
        height: h,
        minWidth: min_w,
        minHeight: min_h,
        titleBarStyle: 'hidden',
        icon: get_icon_path(),
        backgroundColor: "#202020",
        center: true,
        titleBarOverlay: false,
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: true,
            webSecurity: true,
            preload: path.resolve(__dirname, "dist", "preload.bundle.js"),
            sandbox: false,
        },
    });

    // pretty sure this only works on linux
    globalShortcut.register('F12', () => { main_window.webContents.openDevTools({ mode: "detach" }) });
    globalShortcut.register('CommandOrControl+R', () => { main_window.reload() });

    main_window.loadFile(path.join(__dirname, "./renderer/gui/index.html"));
    main_window.setMenuBarVisibility(false);

    // window controls
    ipcMain.handle('maximize', () => main_window.isMaximized() ? main_window.unmaximize() : main_window.maximize()); 
    ipcMain.handle('minimize', () => main_window.minimize());
    ipcMain.handle('close'   , () => app.quit());

    ipcMain.handle('create-dialog', async (_, options) => await create_dialog(options));
    ipcMain.handle('select-file', async (_, options) => {
        const file = await create_dialog(options);
        if (file.canceled) {
            return;
        }
        return { name: path.basename(file.filePaths[0]), buffer: fs.readFileSync(file.filePaths[0]) };
    });

    ipcMain.handle('dev_mode', () => dev_mode);

    // function to get cookies from stats
    ipcMain.handle('fetch-stats', async (event, url, cookies) => {

        return new Promise((resolve, reject) => {

            if (!cookies) {
                return resolve({ ok: false, cookie: true });
            }

            const data = [];
            const request = net.request({
                method: 'GET',
                url: url,
                session: session.defaultSession,
            });

            request.setHeader('Cookie', cookies);
            request.on('response', (response) => {
                
                response.on('data', (chunk) => {
                    data.push(chunk);
                });

                response.on('end', () => {
                    resolve({
                        ok: response.statusCode == 200,
                        status: response.statusCode,
                        data: Buffer.concat(data)
                    });
                });
            });

            request.on('error', reject);
            request.end();
        });
    });

    ipcMain.handle("create-auth", (_, url, end) => create_auth_window(url, end));

    // open dev tools window on dev mode
    main_window.webContents.on('did-finish-load', () => {
        if (dev_mode) {
            main_window.webContents.openDevTools({ mode: "detach" });
        }
    });

    init_downloader(main_window, ipcMain);
};

app.whenReady().then(async () => {
 
    // fetch headers thing
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders } });
    });

    // image protocol so electron dont freak out
    protocol.handle('media', (req) => { 
        const path_to_media = decodeURIComponent(req.url.replace('media://', ''));
        return net.fetch(`file://${path_to_media}`);
    });

    create_window();
});

// hardware acceleraion on linux makes app unstable after 10/20 min (need to test this again btw)
app.on('activate', app.disableHardwareAcceleration);
app.on('will-quit', () => globalShortcut.unregisterAll);
app.on('window-all-closed', app.quit);