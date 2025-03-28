import path from "node:path";
import squirrel_startup from 'electron-squirrel-startup';

import { app, BrowserWindow, ipcMain, dialog, session, net, globalShortcut, Menu } from "electron";
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
const min_w = 800, min_h = 600;
const max_w = 1366, max_h = 900;

export const create_dialog = async () => {
    try {
        return await dialog.showOpenDialog(main_window, {
            properties: ['openDirectory']
        });
    } catch (error) {
        console.error('failed to create dialog:', error);
        return { canceled: true };
    }
};

export const get_icon_path = () => {
    
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

const icon_path = get_icon_path();
Menu.setApplicationMenu(null);

// still need to find a better way to do this
const create_auth_window = (url, end) => {

    if (!url || !end) {
        console.log("missing url or end_url");
        return;
    }

    const auth_window = new BrowserWindow({
        width: w,
        height: h,
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
            webSecurity: !dev_mode,
            preload: path.join(__dirname, 'preload.cjs')
        },
        titleBarOverlay: false,
    });

    // not sure if i need this
    globalShortcut.register('F12', () => {
        console.log("opening devtools");
        main_window.webContents.openDevTools()
    });
    globalShortcut.register('CommandOrControl+R', () => { main_window.reload() });

    // load html yep
    main_window.loadFile(path.join(__dirname, "./gui/index.html"));
    main_window.setMenuBarVisibility(false);

    // window controls
    ipcMain.handle('maximize', () => { }); // maximized version looks ugly as hell, need to finish css for that
    ipcMain.handle('minimize', () => main_window.minimize());
    ipcMain.handle('close'   , () => app.quit());

    // other gargabe
    ipcMain.handle('create-dialog', async () => await create_dialog());
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
 
    // fetch headers thing
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders } });
    });

    createWindow();
});


// hardware accelearion on linux causes window freezing after a while (at least for me) 
app.on('activate', () => {
    if (process.platform == "linux") {
        app.disableHardwareAcceleration();
    }
});

app.on('window-all-closed', () => {
    if (process.platform != 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
