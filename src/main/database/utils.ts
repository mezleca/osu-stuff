import os from "os";
import fs from "fs";
import path from "path";

import { exec } from "child_process";
import { GenericResult } from "@shared/types";
import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";

const TEST_DATA_PATH = path.resolve("tests/.data");

interface PathResult {
    stable_path: string;
    lazer_path: string;
}

export const get_app_path = (): string => {
    if (process.env["NODE_ENV"] == "test") {
        return TEST_DATA_PATH;
    }

    switch (process.platform) {
        case "win32":
            return path.join(path.join(os.homedir(), "AppData", "Roaming"), "osu-stuff");
        case "linux":
            return path.join(os.homedir(), ".local", "share", "osu-stuff");
        default:
            return "";
    }
};

export const get_windows_path = (): PathResult => {
    const result: PathResult = {
        stable_path: "",
        lazer_path: ""
    };

    const stable_path = path.resolve(os.homedir(), "AppData", "Local", "osu!");
    const lazer_path = path.resolve(os.homedir(), "AppData", "Roaming", "osu");

    if (fs.existsSync(stable_path)) {
        result.stable_path = stable_path;
    }

    if (fs.existsSync(lazer_path)) {
        result.lazer_path = lazer_path;
    }

    return result;
};

export const get_linux_path = async (): Promise<PathResult> => {
    const result: PathResult = {
        stable_path: "",
        lazer_path: ""
    };

    const default_stable_path = path.join(os.homedir(), ".local", "share", "osu-wine", "osu!");
    const custom_stable_path = path.join(os.homedir(), ".local/share/osuconfig/osupath");
    const lazer_path = path.join(os.homedir(), ".local", "share", "osu");

    // 99% sure osu-wine also creates this folder so check for realm file
    if (fs.existsSync(path.resolve(lazer_path, "client.realm"))) {
        result.lazer_path = lazer_path;
    }

    if (fs.existsSync(default_stable_path)) {
        result.stable_path = default_stable_path;
        return result;
    }

    // get custom osu-wine path (if available)
    const exec_result = await new Promise((resolve) => {
        exec(`[ -e "$HOME/.local/share/osuconfig/osupath" ] && echo "1"`, (err, stdout, stderr) => {
            if (err) {
                return resolve("");
            }

            if (stderr) {
                return resolve("");
            }

            if (stdout.trim() == "1" && fs.existsSync(custom_stable_path)) {
                return resolve(fs.readFileSync(custom_stable_path, "utf-8").split("\n")[0]);
            }

            return resolve("");
        });
    });

    if (exec_result && exec_result != "") {
        // @ts-ignore
        result.stable_path = exec_result;
    }

    return result;
};

export const get_osu_path = async (): Promise<GenericResult<PathResult>> => {
    switch (process.platform) {
        case "win32":
            return { success: true, data: get_windows_path() };
        case "linux":
            return { success: true, data: await get_linux_path() };
        default:
            return { success: false, reason: "unsupported platform" };
    }
};

// TOFIX: this shouldn't be here
const created_windows: Map<string, BrowserWindow> = new Map();

const create_new_window = (name: string, options: BrowserWindowConstructorOptions) => {
    const new_window = new BrowserWindow(options);
    created_windows.set(name, new_window);
    return new_window;
};

export const get_window = (name: string, options: BrowserWindowConstructorOptions = {}): BrowserWindow => {
    return created_windows.get(name) ?? create_new_window(name, options);
};
