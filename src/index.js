const path = require('node:path');
const electronShortcut = require('electron-localshortcut');

const { app, BrowserWindow, ipcMain } = require('electron');

if (require('electron-squirrel-startup')) {
    app.quit();
}

const w = 968, h = 720;
const dev_mode = process.env.NODE_ENV == "cleide";

const createWindow = () => {

    const mainWindow = new BrowserWindow({
      width: w,
      height: h,
      minWidth: w,
      minHeight: h,
      titleBarStyle: 'hidden',
      frame: true,
      fullscreenable: false,
      resizable: false,
      icon: __dirname + "/images/icon.png",
      webPreferences: {
          devTools: true,
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: true,
          webSecurity: dev_mode ? false : true,
      },
      titleBarOverlay: {
        color: '#202020',
        symbolColor: '#ffffff'
      }
    });

    if (process.env.NODE_ENV == "cleide") {
        mainWindow.webContents.openDevTools();
    }

    electronShortcut.register(mainWindow, 'F12', () => {
        mainWindow.webContents.openDevTools();
    });

    electronShortcut.register(mainWindow, 'Ctrl+R', () => {
        mainWindow.reload();
    });

    mainWindow.loadFile(path.join(__dirname, './gui/index.html'));
    mainWindow.setMenuBarVisibility(false);

    // nah
    mainWindow.on('maximize', () => mainWindow.unmaximize());

    ipcMain.handle('is-window-full', () => mainWindow.isMaximized());
    ipcMain.on('close-window', () => app.quit());
};

app.whenReady().then(() => {

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
