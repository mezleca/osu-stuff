import path from "node:path";
import shortcut from "electron-localshortcut";
import Store from "electron-store";
import squirrel_startup from 'electron-squirrel-startup';

import { app, BrowserWindow, ipcMain, dialog, protocol, net } from "electron";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {BrowserWindow} */
let main_window = null;

if (squirrel_startup) {
    app.quit();
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const dev_mode = process.env.NODE_ENV == "cleide";
const store = new Store();

export const create_dialog = async () => {

    const created_dialog = await dialog.showOpenDialog(main_window, {
        properties: ['openDirectory']
    });

    return created_dialog;
};

export const get_icon_path = () => {

    const base_path = path.resolve("../build/icons");

    switch (process.platform) {
        case "win32":
            return path.join(base_path, "win/icon.ico");
        case "linux": 
            return path.join(base_path, "png/256x256");
        default: 
            return path.join(base_path, "png/256x256");
    }
};

// xd
const w = 968, h = 720;
const min_w = 820, min_h = 580;
const max_w = 1080, max_h = 820;

const icon_path = get_icon_path();

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

    ipcMain.on('close-window', () => app.quit());

    ipcMain.handle('is-window-full', () => main_window.isMaximized());
    ipcMain.handle('electron-store-get', (event, key) => store.get(key));
    ipcMain.handle('electron-store-set', (event, key, value) => store.set(key, value));
    ipcMain.handle('create-dialog', async () => await create_dialog());
    ipcMain.handle('dev_mode', () => dev_mode);

    main_window.webContents.on('did-finish-load', () => {

        main_window.webContents.executeJavaScript(`
            const script = document.createElement('script');
            script.src = "${dev_mode ? '../js/app.js' : '../dist/bundle.js'}";
            script.type = "module";
            document.body.appendChild(script);
        `);

        if (process.env.NODE_ENV == "cleide") {
            main_window.webContents.openDevTools({ mode: "detach", activate: true, });
        }
    });

    global.store = store;
};

app.whenReady().then(async () => {

    createWindow();

    app.on('activate', () => {

        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    protocol.handle('file', (request) => {
        const pathname = decodeURI(request.url.replace('file:///', ''));
        net.fetch(pathname);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});