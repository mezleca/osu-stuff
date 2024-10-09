import path from "node:path";
import shortcut from "electron-localshortcut";
import squirrel_startup from 'electron-squirrel-startup';

import { app, BrowserWindow, ipcMain, dialog, session, net } from "electron";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {BrowserWindow} */
let main_window = null;

if (squirrel_startup) {
    app.quit();
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const dev_mode = process.env.NODE_ENV == "development";

const w = 968, h = 720;
const min_w = 820, min_h = 580;
const max_w = 1080, max_h = 820;

export const create_dialog = async () => {
    return dialog.showOpenDialog(main_window, {
        properties: ['openDirectory']
    });
};

export const get_icon_path = () => {

    const base_path = path.resolve("./build/icons");
    
    switch (process.platform) {
        case "win32":
            return path.join(base_path, "win/icon.ico");
        case "linux": 
            return path.join(base_path, "png/256x256");
        default: 
            return path.join(base_path, "png/256x256");
    }
};

const icon_path = get_icon_path();

const create_auth_window = (url, end) => {

    if (!url || !end) {
        console.log("missing url or end_url");
        return;
    }

    console.log("initialinzgu autj winwos", url, end);

    const auth_window = new BrowserWindow({
        width: 800,
        height: 700,
        fullscreenable: false,
        icon: icon_path,
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: true,
            webSecurity: false
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

console.log("icon path", icon_path);

const createWindow = () => {

    main_window = new BrowserWindow(
    {
        width: w,
        height: h,
        minWidth: min_w,
        minHeight: min_h,
        maxWidth: max_w,
        maxHeight: max_h,
        titleBarStyle: 'hidden',
        frame: true,
        fullscreenable: false,
        icon: icon_path,
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: true,
            webSecurity: dev_mode ? false : true,
            preload: path.join(__dirname, 'preload.cjs')
        },
        titleBarOverlay: {
            color: '#202020',
            symbolColor: '#ffffff'
        }
    });

    shortcut.register(main_window, 'F12', () => main_window.webContents.openDevTools());
    shortcut.register(main_window, 'Ctrl+R', () => main_window.reload());

    main_window.loadFile(path.join(__dirname, "./gui/index.html"));
    main_window.setMenuBarVisibility(false);
    main_window.on('maximize', () => main_window.unmaximize());

    ipcMain.on('close-window', () => app.quit());

    ipcMain.handle('is-window-full', () => main_window.isMaximized());
    ipcMain.handle('create-dialog', async () => await create_dialog());
    ipcMain.handle('dev_mode', () => dev_mode);
    ipcMain.handle('fetch-stats', async (event, url, cookies) => {

        return new Promise((resolve, reject) => {

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

    ipcMain.handle("create-auth", async (event, url, end) => {
        return create_auth_window(url, end);
    });

    main_window.webContents.on('did-finish-load', () => {
        main_window.webContents.executeJavaScript(`
            const script = document.createElement('script');
            script.src = "${dev_mode ? '../js/app.js' : '../dist/bundle.js'}";
            script.type = "module";
            document.body.appendChild(script);
        `);
        if (process.env.NODE_ENV == "development") {
            main_window.webContents.openDevTools({ mode: "detach", activate: true, });
        }
    });
};

app.whenReady().then(async () => {
 
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders } });
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});