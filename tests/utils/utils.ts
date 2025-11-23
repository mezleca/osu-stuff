import fs from "fs";
import path from "path";

import { exec } from "child_process";
import { IBeatmapResult, StuffConfig } from "@shared/types";
import { config as _config } from "@main/database/config";
import { mirrors as _mirrors } from "@main/database/mirrors";

export const TEMP_DIR = path.resolve(__dirname, "..", ".temp");

const DATA_DIR = path.resolve("tests", ".data");
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const generate_random_string = (size: number) => {
    let result = "";
    for (var i = 0; i < size; i++) {
        result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return result;
};

export const create_temp_beatmap = (): IBeatmapResult => {
    return {
        md5: generate_random_string(32),
        online_id: 1,
        beatmapset_id: 1,
        title: "hello world",
        artist: "hello world",
        creator: "a",
        difficulty: "b",
        tags: [],
        ar: 0,
        cs: 0,
        hp: 0,
        od: 0,
        star_rating: 0,
        bpm: 0,
        length: 120,
        status: "ranked",
        mode: "osu!",
        local: false,
        last_modified: "",
        temp: true
    };
};

export const create_temp_path = () => {
    fs.mkdirSync(TEMP_DIR);
};

export const run_sh = (command: string) => {
    return new Promise((res) => {
        exec(command, res);
    });
};

export const clean_test_path = async () => {
    if (!fs.existsSync(TEMP_DIR)) {
        create_temp_path();
        return;
    }

    if (process.platform == "win32") {
        await run_sh(`powershell -Command "Remove-Item '${TEMP_DIR}\\*' -Force -Recurse -ErrorAction SilentlyContinue"`);
    } else {
        await run_sh(`rm -rf ${TEMP_DIR}/*`);
    }
};

export const setup_config = () => {
    clean_test_path();
    _config.initialize();
    _mirrors.initialize();

    const config_data: Partial<StuffConfig> = {
        stable_path: path.resolve(DATA_DIR, "osu"),
        stable_songs_path: path.resolve(DATA_DIR, "osu", "Songs"),
        lazer_path: path.resolve(DATA_DIR, "lazer"),
        export_path: TEMP_DIR
    };

    _config.update(config_data);
    _mirrors.update("nery", "https://api.nerinyan.moe/d/");
};

(() => {
    setup_config();
})();

export const config = _config;
export const mirrors = _mirrors;
