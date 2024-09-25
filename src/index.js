import path from "node:path";
import shortcut from "electron-localshortcut";
import Store from "electron-store";
import express from "express";
import axios from "axios";
import crypto from "crypto";

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

const CLIENT_ID = '35048';
const REDIRECT_URI = 'http://127.0.0.1:8082/token';

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

const generate_verifier = () => {
    return crypto.randomBytes(32).toString('base64url');
}

const generate_challenge = (verifier) => {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

const create_auth_window = () => {

    const code_verifier = generate_verifier();
    const code_challenge = generate_challenge(code_verifier);

    const auth_window = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
    });

    const auth_url = `https://osu.ppy.sh/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=identify&code_challenge=${code_challenge}&code_challenge_method=S256`;
  
    auth_window.loadURL(auth_url);
    auth_window.show();

    return new Promise((resolve, reject) => {

        auth_window.webContents.on('will-navigate', async (event, url) => {

            const code = new URL(url).searchParams.get('code');
    
            if (code) {
                auth_window.close();
            }
    
            try {
                const tokens = await get_token(code, code_verifier);
                resolve(tokens);
            } 
            catch (error) {
                reject(error);
            }
        });
    
        auth_window.on('closed', () => {
            reject(new Error('Authorization window was closed'));
        });
    });
};

const get_token = async (code, code_verifier) => {

    try {

        const response = await axios.post('https://osu.ppy.sh/oauth/token', {
            client_id: CLIENT_ID,
            code_verifier: code_verifier,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI
        });

        const { access_token, refresh_token } = response.data;

        return {
            access_token, 
            refresh_token
        }
    } catch (error) {
        console.error('Erro ao trocar o código por token:', error);
    }
}

express_app.get("/token", async (req, res) => {

    const body = req.body;
    console.log(body);
});

express_app.listen(8082);