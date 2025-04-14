import { path, extra } from "../global.js";

const windows_default_path = path.resolve(extra.homedir, "AppData", "Local", "osu!");

export const get_og_path = () => {
    switch (window.process.platform) {
        case 'win32':
            return path.join(path.join(extra.homedir, 'AppData', 'Roaming'), "osu-stuff");
        case 'linux':
            return path.join(extra.homedir, '.local', 'share', "osu-stuff");
        default:
            return "";
    }
}

export const get_linux_path = async () => {
    const result = await window.path.get_linux_path();
    return result;
};

export const get_osu_base_path = async () => {
    switch (process.platform) {
        case 'win32':
            return windows_default_path;
        case 'linux': // pretty sure everyone uses osu-wine to play stable on linux
            return await get_linux_path();
        default:
            return "";
    }
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

    return new Promise(async (resolve) => {

        const data = await window.extra.exec_sh(cmd);

        if (data.error) {
            console.log("failed to execute shell command", data);
            return;
        }

        resolve(data.output.toLowerCase().indexOf(name.toLowerCase()) > -1);
    });
};

export const open_url        = (url, options) => window.shell.openExternal(url, options);
export const fetchstats      = (url, cookies) => window.extra.fetch_stats(url, cookies);
export const create_auth     = (url, end) => window.extra.create_auth(url, end);
export const create_dialog   = (options) => window.extra.create_dialog(options);
export const select_file     = (options) => window.extra.select_file(options);
export const maximize_window = () => window.extra.maximize_window();
export const minimize_window = () => window.extra.minimize_window();
export const close_window    = () => window.extra.close_window();
