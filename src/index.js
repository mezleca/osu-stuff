const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// im still learning about electron but im pretty sure this is way better than the terminal.

/** @type {BrowserWindow} */
let mainWindow;

if (require('electron-squirrel-startup')) {
    app.quit();
}

console.log(__dirname);

const createWindow = () => {

    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      titleBarStyle: 'hidden',
      frame: true,
      icon: __dirname + "/icon.png",
      webPreferences: {
          devTools: false,
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: true,
          contextIsolation: false,
      },
      titleBarOverlay: {
        color: '#1f1f1f',
        symbolColor: '#ffffff'
      }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.setMenuBarVisibility(false);

    ipcMain.handle('is-window-full', () => {
        return mainWindow.isMaximized();
    });
  
    ipcMain.on('close-window', () => {
        app.quit();
    });
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
