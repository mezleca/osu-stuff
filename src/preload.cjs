const path = require("path");
const fs = require("fs");

const { contextBridge, ipcRenderer } = require("electron");
const { exec } = require("child_process");

export const openFolder = (folder_path) => {
    const cmd = `start "" "${folder_path}"`;

    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.log(err);
        }
    });
};

export const isProcessRunning = (name) => {
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

contextBridge.exposeInMainWorld('electron', {
    dev_mode: process.env.NODE_ENV === "cleide",
    fs: {
        renameSync: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
        readdirSync: (directoryPath) => fs.readdirSync(directoryPath),
        createWriteStream: (filePath, options) => fs.createWriteStream(filePath, options),
        readFileSync: (filePath, encoding) => fs.readFileSync(filePath, encoding),
        writeFileSync: (filePath, data, options) => fs.writeFileSync(filePath, data, options),
        unlinkSync: (filePath) => fs.unlinkSync(filePath),
        existsSync: (filePath) => fs.existsSync(filePath),
        mkdirSync: (dirPath, options) => fs.mkdirSync(dirPath, options)
    },
    path: {
        join: (...paths) => path.join(...paths),
        resolve: (...paths) => path.resolve(...paths),
        basename: (filePath, ext) => path.basename(filePath, ext),
        dirname: (filePath) => path.dirname(filePath),
        extname: (filePath) => path.extname(filePath)
    },
    store: {
        get: (key) => ipcRenderer.invoke('electron-store-get', key),
        set: (key, value) => ipcRenderer.invoke('electron-store-set', key, value)
    }
});