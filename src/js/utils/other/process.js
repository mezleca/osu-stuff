const { exec } = require('child_process');
const { ipcRenderer, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const windows_default_path = path.resolve(os.homedir(), "..", "Local", "osu!");

export const get_og_path = () => {
    switch (process.platform) {
        case 'win32':
            return path.join(path.join(os.homedir(), 'AppData', 'Roaming'), "osu-stuff");
        case 'linux':
            return path.join(os.homedir(), '.local', 'share', "osu-stuff");
        default:
            return "";
    }
}

export const get_linux_path = async () => {

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

export const get_osu_base_path = async () => {
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

export const open_folder = (folder_path) => {
    const cmd = `start "" "${folder_path}"`;
    exec(cmd, (err) => {
        if (err) {
            console.log(err);
        }
    });
};

export const is_running = (name) => {

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

export const open_url        = (url) => shell.openExternal(url);
export const fetchstats      = (url, cookies) => ipcRenderer.invoke('fetch-stats', url, cookies)
export const create_auth     = (url, end) => ipcRenderer.invoke("create-auth", url, end)
export const create_dialog   = () => ipcRenderer.invoke('create-dialog');
export const maximize_window = () => ipcRenderer.invoke('maximize');
export const minimize_window = () => ipcRenderer.invoke('minimize');
export const close_window    = () => ipcRenderer.invoke('close');
