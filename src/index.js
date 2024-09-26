import path from "node:path";
import shortcut from "electron-localshortcut";
import Store from "electron-store";
import express from "express"

import { app, BrowserWindow, ipcMain } from "electron";
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @type {BrowserWindow} */
let main_window = null;

const w = 968, h = 720;
const min_w = 820, min_h = 580;
const max_w = 1080, max_h = 820;

const __dirname = dirname(fileURLToPath(import.meta.url));

const dev_mode = process.env.NODE_ENV == "cleide";
const store = new Store();
const express_app = express();

const AUTH_URL = 'http://26.113.5.8:8084/auth';

express_app.set(express.json());

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
        icon: __dirname + "/images/icon.png",
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: dev_mode ? false : true,
            preload: pathToFileURL(path.join(__dirname, 'preload.js')).href
        },
        titleBarOverlay: {
            color: '#202020',
            symbolColor: '#ffffff'
        }
    });

    if (process.env.NODE_ENV == "cleide") {
        main_window.webContents.openDevTools();
    }

    shortcut.register(main_window, 'F12', () => {
        main_window.webContents.openDevTools();
    });

    shortcut.register(main_window, 'Ctrl+R', () => {
        main_window.reload();
    });

    main_window.loadFile(path.join(__dirname, './gui/index.html'));
    main_window.setMenuBarVisibility(false);

    // nah
    main_window.on('maximize', () => main_window.unmaximize());

    ipcMain.handle('is-window-full', () => main_window.isMaximized());
    ipcMain.on('close-window', () => app.quit());
    ipcMain.handle('electron-store-get', (event, key) => store.get(key));
    ipcMain.handle('electron-store-set', (event, key, value) => store.set(key, value));

    global.store = store;
};

app.whenReady().then(async () => {

    // create app window
    // createWindow();

    // auth test window
    await create_auth_window();

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

const create_auth_window = () => {

    const auth_window = new BrowserWindow({
        width: 800,
        height: 700,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
  
    auth_window.loadURL(AUTH_URL);
    auth_window.show();

    return new Promise((resolve, reject) => {

        auth_window.webContents.on('did-navigate', (event, new_url) => {
            if (new_url.includes('/end')) {
                auth_window.close();
            }
        });

        auth_window.on('closed', () => {
            reject(new Error('authorization window was closed'));
        });
    });
};

express_app.get("/end", async (req, res) => {

    const query = req.query;

    if (!query?.code) {
        return res.sendStatus(400);
    }

    // TODO: save everything using the electron store shit
});

express_app.listen(8082);