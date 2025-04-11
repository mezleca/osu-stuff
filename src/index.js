import path from "path";

import { app, BrowserWindow, ipcMain, dialog, session, net, globalShortcut, Menu, protocol } from "electron";
import { fileURLToPath } from 'url';

/** @type {BrowserWindow} */
let main_window = null;

Menu.setApplicationMenu(null);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dev_mode = process.env.NODE_ENV == "development";

const w = 1120, h = 840;
const min_w = 968, min_h = 720;
const max_w = 1366, max_h = 900;

const squirrel_params = ["--squirrel-install", "--squirrel-updated", "--squirrel-uninstall"];

// quit if we are installing or updating it
if (process.argv[1] && squirrel_params.includes(process.argv[1])) {
    app.quit();
}

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
        icon: get_icon_path(),
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
        },
        titleBarOverlay: false,
    });

    globalShortcut.register('CommandOrControl+R', () => { main_window.reload() });
    globalShortcut.register('F12', () => { main_window.webContents.openDevTools({ mode: "detach" })});

    // load html yep
    main_window.loadFile(path.join(__dirname, "./gui/index.html"));
    main_window.setMenuBarVisibility(false);

    // window controls
    ipcMain.handle('maximize', () => { }); // maximized version looks ugly as hell, need to finish css for that
    ipcMain.handle('minimize', () => main_window.minimize());
    ipcMain.handle('close'   , () => app.quit());

    // other gargabe
    ipcMain.handle('create-dialog', async (_, options) => await create_dialog(options));
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

        // load files
        main_window.webContents.executeJavaScript(`
            const script = document.createElement('script');
            script.src = "${dev_mode ? '../js/app.js' : '../dist/app.bundle.js'}";
            script.type = "module";
            
            const file = location.pathname.split("/").pop();
            const link = document.createElement("link");
            const ext = ${dev_mode ? '".css"' : '".min.css"'};
            console.log(file.substr(0, file.lastIndexOf(".")) + ext);
            link.href = ${dev_mode ? '"./index.css"' : '"../dist/index.min.css"'};
            link.type = "text/css";
            link.rel = "stylesheet";
            link.media = "screen,print";
           
            document.getElementsByTagName("head")[0].appendChild(link);
            document.body.appendChild(script);
        `);

        if (process.env.NODE_ENV == "development") {
            main_window.webContents.openDevTools({ mode: "detach" });
        }
    });
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
