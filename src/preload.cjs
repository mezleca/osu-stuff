const path = require("path");
const fs = require("fs");
const axios = require("axios");

const { contextBridge, ipcRenderer, shell } = require("electron");
const { exec } = require("child_process");

// https://stackoverflow.com/questions/49967779/axios-handling-errors
axios.interceptors.response.use(function (response) {
    return response;
  }, function (error) {
    return Promise.reject(error);
});

const open_folder = (folder_path) => {
    const cmd = `start "" "${folder_path}"`;

    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.log(err);
        }
    });
};

const is_running = (name) => {

    let platform = process.platform;
    let cmd = '';

    switch (platform) {
        case 'win32':
            cmd = `tasklist`;
            break;
        case 'darwin':
            cmd = `ps -ax | grep ${name}`;
            break;
        case 'linux':
            cmd = `ps -A`;
            break;
        default:
            break;
    }

    return new Promise(resolve => {
        exec(cmd, (err, stdout, stderr) => {
            const is_running = stdout.toLowerCase().indexOf(name.toLowerCase()) > -1;
            resolve(is_running);
        });
    });
};

contextBridge.exposeInMainWorld("nodeAPI", {
    env: {
        APPDATA: process.env.APPDATA
    },
    fs: {
        renameSync: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
        readdirSync: (directoryPath) => fs.readdirSync(directoryPath),
        readFileSync: (filePath, encoding) => fs.readFileSync(filePath, encoding),
        writeFileSync: (filePath, data, options) => fs.writeFileSync(filePath, data, options),
        writeFileSyncView: (filePath, data, options) => {
            const converted_buffer = Buffer.from(data);
            fs.writeFileSync(filePath, converted_buffer, options);
        },
        unlinkSync: (filePath) => fs.unlinkSync(filePath),
        rmdirSync: (path, options) => fs.rmdirSync(path, options),
        existsSync: (filePath) => fs.existsSync(filePath),
        mkdirSync: (dirPath, options) => fs.mkdirSync(dirPath, options)
    },
    path: {
        join: (...paths) => path.join(...paths),
        resolve: (...paths) => path.resolve(...paths),
        basename: (filePath, ext) => path.basename(filePath, ext),
        dirname: (filePath) => path.dirname(filePath),
        extname: (filePath) => path.extname(filePath)
    }
});

contextBridge.exposeInMainWorld('electron', {
    dev_mode: process.env.NODE_ENV === "cleide",
    shell: {
        openExternal: (url) => shell.openExternal(url),
    },
    store: {
        get: (key) => ipcRenderer.invoke('electron-store-get', key),
        set: (key, value) => ipcRenderer.invoke('electron-store-set', key, value)
    },
    create_dialog: async () => await ipcRenderer.invoke("create-dialog"), 
    is_running: async (name) => await is_running(name),
    open_folder: (folder_path) => open_folder(folder_path)
});