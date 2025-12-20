import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { IBeatmapResult, StuffConfig } from "@shared/types";
import { config as _config } from "@main/database/config";
import { mirrors as _mirrors } from "@main/database/mirrors";
import { beatmap_processor as _processor } from "@main/database/processor";

export const DATA_URL = "https://github.com/mezleca/osu-stuff/releases/download/beatmaps/data.tar.gz";
export const TEMP_DIR = path.resolve("tests", ".temp_data");
export const DATA_DIR = path.resolve("tests", ".data");

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const generate_random_string = (size: number) => {
    let result = "";
    for (let i = 0; i < size; i++) {
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
        last_modified: "",
        temp: true,
        background: ""
    };
};

export const run_sh = (command: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        console.log(`[EXEC] running: ${command}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`[EXEC ERROR] ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.warn(`[EXEC STDERR] ${stderr}`);
            }
            if (stdout) {
                console.log(`[EXEC STDOUT] ${stdout}`);
            }
            resolve();
        });
    });
};

export const download_data = async (): Promise<void> => {
    console.log(`[DOWNLOAD] starting data download from ${DATA_URL}`);

    try {
        // create data dir if not exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        const command = `curl -L ${DATA_URL} | tar -xz --strip-components=3 -C ${DATA_DIR}`;
        await run_sh(command);

        console.log("[DOWNLOAD] data downloaded successfully");

        // verify extraction worked
        const files = fs.readdirSync(DATA_DIR);
        console.log(`[DOWNLOAD] extracted files: ${files.join(", ")}`);
    } catch (error) {
        console.error("[DOWNLOAD ERROR] failed to download data:", error);
        throw error;
    }
};

export const setup_test_env = async (): Promise<void> => {
    console.log("[SETUP] initializing test environment");
    console.log(`[SETUP] temp dir: ${TEMP_DIR}`);
    console.log(`[SETUP] data dir: ${DATA_DIR}`);

    try {
        // remove temp dir if exists
        if (fs.existsSync(TEMP_DIR)) {
            console.log("[SETUP] removing existing temp directory");
            fs.rmSync(TEMP_DIR, { recursive: true, force: true });
        }

        // download data if doesnt exist
        if (!fs.existsSync(DATA_DIR)) {
            console.log("[SETUP] data directory not found, downloading...");
            await download_data();
        } else {
            console.log("[SETUP] data directory found, skipping download");
        }

        // create temp directory
        console.log("[SETUP] creating temp directory");
        fs.mkdirSync(TEMP_DIR, { recursive: true, mode: 0o777 });

        // copy files
        console.log("[SETUP] copying files to temp directory");
        fs.cpSync(DATA_DIR, TEMP_DIR, {
            recursive: true,
            force: true
        });

        console.log("[SETUP] test environment ready");
    } catch (error) {
        console.error("[SETUP ERROR] failed to setup test environment:", error);
        throw error;
    }
};

export const setup_config = async (): Promise<void> => {
    console.log("[CONFIG] starting configuration setup");

    try {
        await setup_test_env();

        console.log("[CONFIG] reinitializing modules");
        _config.reinitialize();
        _processor.reinitialize();
        _mirrors.reinitialize();

        const config_data: Partial<StuffConfig> = {
            stable_path: path.resolve(TEMP_DIR, "osu"),
            stable_songs_path: path.resolve(TEMP_DIR, "osu", "Songs"),
            lazer_path: path.resolve(TEMP_DIR, "lazer"),
            export_path: TEMP_DIR
        };

        console.log("[CONFIG] updating config:", config_data);
        _config.update(config_data);
        _mirrors.update("nery", "https://api.nerinyan.moe/d/");

        console.log("[CONFIG] configuration setup complete");
    } catch (error) {
        console.error("[CONFIG ERROR] failed to setup config:", error);
        throw error;
    }
};
