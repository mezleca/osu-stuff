import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";

import { get_app_path } from "../database/utils";
import { spawn } from "child_process";

// @TODO: send notification to main process on success, error, etc...

const is_windows = process.platform == "win32";

export class YTdlp {
    constructor(location) {
        if (!location) {
            throw new Error("missing location");
        }

        this.temp_location = path.resolve(location, "temp");

        if (!fs.existsSync(location)) {
            fs.mkdirSync(location, { recursive: true });
        }

        if (!fs.existsSync(this.temp_location)) {
            fs.mkdirSync(this.temp_location);
        }

        this.initialized = false;
        this.ext = is_windows ? "_x86.exe" : "_linux";
        this.name = `yt-dlp${this.ext}`;
        this.version = "";
        this.repository = "yt-dlp/yt-dlp";
        this.custom_ffmpeg_location = path.resolve(location, "ffmpeg");
        this.binary_location = path.resolve(location, this.name);
        this.version_location = path.resolve(location, "yt-dlp-version");
    }

    async initialize() {
        try {
            // download ffmpeg binary on windows
            if (is_windows) await this.download_ffmpeg();

            // check if our binary already exists
            if (fs.existsSync(this.binary_location) && fs.existsSync(this.version_location)) {
                const saved_version = fs.readFileSync(this.version_location, "utf-8");
                const latest_version = await this.get_latest_version();

                // check if we're on the latest version
                if (saved_version == latest_version) {
                    this.update_version(latest_version);
                    this.initialized = true;
                    return true;
                }

                console.log(`dlp: detected new yt-dlp version\ndownloading: ${latest_version}`);
            } else {
                console.log("dlp: downloading latest yt-dlp binary");
            }

            // otherwise download latest version
            const new_binary = await this.download_latest_binary();

            if (!new_binary) {
                console.error("dlp: failed to download yt-dlp binary");
                return false;
            }

            const { buffer, version } = new_binary;

            // update binary / version
            fs.writeFileSync(this.binary_location, Buffer.from(buffer));

            // give exec permission on linux
            if (process.platform == "linux") {
                console.log("dlp: ensuring yt-dlp binary has exec permissions");
                fs.chmodSync(this.binary_location, 0o755);
            }

            this.update_version(version);
            this.initialized = true;
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    async get_latest_version() {
        const result = await fetch(`https://api.github.com/repos/${this.repository}/releases/latest`);

        if (result.status != 200) {
            console.log("dlp: failed to get latest version, reason:", result.statusText);
            return false;
        }

        const data = await result.json();
        return data.name;
    }

    async download_latest_binary() {
        const result = await fetch(`https://api.github.com/repos/${this.repository}/releases/latest`);

        if (result.status != 200) {
            console.log("dlp: failed to fetch github, reason:", result.statusText);
            return false;
        }

        const data = await result.json();

        // loop through assets until we find the correct binary
        const target_name = is_windows ? "yt-dlp_x86.exe" : "yt-dlp_linux";
        const target_asset = data.assets.find((a) => a.name == target_name);

        if (!target_asset) {
            console.log("dlp: unable to find target name:", target_name);
            return false;
        }

        const download_result = await fetch(target_asset.browser_download_url);

        if (download_result.status != 200) {
            console.log("dlp: failed to download yt-dlp binary, reason:", download_result.statusText);
            return false;
        }

        const buffer = await download_result.arrayBuffer();
        return { version: data.name, buffer };
    }

    update_version(version) {
        this.version = version;
        fs.writeFileSync(this.version_location, version, "utf-8");
    }

    async download_ffmpeg() {
        if (fs.existsSync(this.custom_ffmpeg_location)) {
            return;
        }

        // ensure folder is created
        if (!fs.existsSync(this.custom_ffmpeg_location)) {
            fs.mkdirSync(this.custom_ffmpeg_location, { recursive: true });
        }

        console.log("dlp: downloading ffmpeg for windows");

        const FFMPEG_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip";
        const response = await fetch(FFMPEG_URL);

        if (response.status != 200) {
            console.log("failed to download ffmpeg", response.statusText);
            return;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        for (const entry of entries) {
            if (entry.entryName.includes("/bin/") && !entry.isDirectory) {
                const file_name = path.basename(entry.entryName);
                const final_path = path.resolve(this.custom_ffmpeg_location, file_name);
                const content = entry.getData();
                fs.writeFileSync(final_path, content);
            }
        }
    }

    async exec(additional_args = []) {
        // check if the binary exists
        if (!this.is_binary_available()) {
            console.log("dlp: binary is not available");
            return false;
        }

        // build base args with common configurations
        // @TODO: disable verbose on prod
        const base_args = ["--verbose"];

        // add custom ffmpeg PATH on windows
        if (is_windows) {
            base_args.push("--ffmpeg-location", this.custom_ffmpeg_location);
        }

        // combine base args with additional args
        const args = [...base_args, ...additional_args];

        const result = await new Promise((r) => {
            const proc = spawn(this.binary_location, args);
            let stdout_buffer = "";
            let stderr_buffer = "";

            proc.stdout.on("data", (d) => {
                stdout_buffer += d.toString();
            });

            proc.stderr.on("data", (d) => {
                stderr_buffer += d.toString();
            });

            proc.on("close", (code) => {
                r({
                    code,
                    stdout: stdout_buffer,
                    stderr: stderr_buffer
                });
            });
        });

        return result ?? false;
    }

    get_binary_location() {
        return this.binary_location;
    }

    get_custom_ffmpeg_location() {
        return this.custom_ffmpeg_location;
    }

    is_binary_available() {
        return fs.existsSync(this.binary_location);
    }
}

export const yt_dlp = new YTdlp(get_app_path());
