import fs from "fs";
import path from "path";

import { exec } from "child_process";
import { IBeatmapResult, StuffConfig } from "@shared/types";
import { config as _config } from "@main/database/config";
import { mirrors as _mirrors } from "@main/database/mirrors";

export const TEMP_DIR = path.resolve("tests", ".temp_data");
export const DATA_DIR = path.resolve("tests", ".data");

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

export const copy_test_stuff = () => {
    if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    // create temp directory with write permissions
    fs.mkdirSync(TEMP_DIR, { recursive: true, mode: 0o777 });

    // copy files
    fs.cpSync(DATA_DIR, TEMP_DIR, {
        recursive: true,
        force: true
    });
};

export const setup_config = () => {
    copy_test_stuff();

    _config.reinitialize();
    _mirrors.reinitialize();

    const config_data: Partial<StuffConfig> = {
        stable_path: path.resolve(TEMP_DIR, "osu"),
        stable_songs_path: path.resolve(TEMP_DIR, "osu", "Songs"),
        lazer_path: path.resolve(TEMP_DIR, "lazer"),
        export_path: TEMP_DIR
    };

    _config.update(config_data);
    _mirrors.update("nery", "https://api.nerinyan.moe/d/");
};
