import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld('electron', {
    store: {
        get: (key) => ipcRenderer.invoke('electron-store-get', key),
        set: (key, value) => ipcRenderer.invoke('electron-store-set', key, value),
    },
});