const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const os = require("os");

const { contextBridge, ipcRenderer, shell } = require("electron");
const { exec } = require("child_process");

const windows_default_path = path.resolve(os.homedir(), "..", "Local", "osu!");

const get_og_path = () => {
    switch (process.platform) {
        case 'win32':
            return path.join(path.join(os.homedir(), 'AppData', 'Roaming'), "osu-stuff");
        case 'linux':
            return path.join(os.homedir(), '.local', 'share', "osu-stuff");
        default:
            return "";
    }
}

const get_linux_path = async () => {

    return new Promise((resolve, reject) => {

        const default_path = path.join(os.homedir(), '.local', 'share', 'osu-wine', 'osu!');
        const custom_path = path.join(os.homedir(), ".local/share/osuconfig/osupath");

        // check if its in the default path
        if (fs.existsSync(default_path)) {
            return resolve(default_path);
        }

        // maybe its using a custom path?
        exec(`[ -e "$HOME/.local/share/osuconfig/osupath" ] && echo "1"`, (err, stdout, stderr) => {
            if (err) {
                return reject(err);
            }
            if (stderr) {
                return reject(err);
            }
            if (stdout == 1) {
                return resolve(fs.readFileSync(custom_path, "utf-8").split("\n")[0]);
            }
        });
    });
};

const get_osu_base_path = async () => {
    // @TODO: macos support
    switch (process.platform) {
        case 'win32':
            return windows_default_path;
        case 'linux': // pretty sure everyone uses osu-wine to play stable on linux
            return await get_linux_path();
        default:
            return "";
    }
};

const open_folder = (folder_path) => {
    const cmd = `start "" "${folder_path}"`;
    exec(cmd, (err) => {
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
    zlib: {
        gunzip: (buf, options) => zlib.gunzipSync(Buffer.from(buf), options)
    },
    env: {
        APPDATA: process.env.APPDATA,
        og_path: get_og_path(),
    },
    fs: {
        renameSync: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
        readdirSync: (directoryPath) => fs.readdirSync(directoryPath),
        readFileSync: (filePath, encoding) => fs.readFileSync(filePath, encoding),
        writeFileSync: (filePath, data, options) => fs.writeFileSync(filePath, Buffer.from(data), options),
        unlinkSync: (filePath) => fs.unlinkSync(filePath),
        rmdirSync: (path, options) => fs.rmdirSync(path, options),
        existsSync: (filePath) => fs.existsSync(filePath),
        mkdirSync: (dirPath, options) => fs.mkdirSync(dirPath, options),
        statSync: (filePath) => fs.statSync(filePath)
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
    dev_mode: process.env.NODE_ENV === "development",
    shell: {
        openExternal: (url) => shell.openExternal(url),
    },
    maximize: async () => await ipcRenderer.invoke('maximize'),
    minimize: async () => await ipcRenderer.invoke('minimize'),
    close: async () => await ipcRenderer.invoke('close'),
    fetchstats: async (url, cookies) => await ipcRenderer.invoke('fetch-stats', url, cookies),
    create_dialog: async () => await ipcRenderer.invoke("create-dialog"),
    create_auth: async (url, end) => await ipcRenderer.invoke("create-auth", url, end),
    is_running: async (name) => await is_running(name),
    open_folder: (folder_path) => open_folder(folder_path),
    osu_default_path: async () => await get_osu_base_path()
});
