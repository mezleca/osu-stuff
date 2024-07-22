const path = require('node:path');
const electronReload = require('electron-reload');
const electronShortcut = require('electron-localshortcut');

const { app, BrowserWindow, ipcMain } = require('electron');

if (require('electron-squirrel-startup')) {
    app.quit();
}

if (process.env.NODE_ENV == "cleide") {
    electronReload(__dirname);
}

const createWindow = () => {

    const mainWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      minWidth: 1024,
      minHeight: 768,
      titleBarStyle: 'hidden',
      frame: true,
      fullscreenable: false,
      resizable: false,
      icon: __dirname + "/images/icon.png",
      webPreferences: {
          devTools: true,
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: true,
          contextIsolation: false,
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
