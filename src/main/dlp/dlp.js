import path from "path";
import fs from "fs";
import StreamZip from "node-stream-zip";

import { spawn } from "child_process";
import { get_app_path } from "../database/utils";

// @TODO: send notification to main process on success, error, etc...

const is_windows = process.platform == "win32";

class SongDownloader {
    constructor(repository, location) {
        if (!location || !repository) {
            throw new Error("missing paramater");
        }

        this.temp_location = path.resolve(location, "temp");
        this.downloaded_location = path.resolve(location, "downloaded");

        if (!fs.existsSync(location)) {
            fs.mkdirSync(location, { recursive: true });
        }

        if (!fs.existsSync(this.temp_location)) {
            fs.mkdirSync(this.temp_location);
        }

        if (!fs.existsSync(this.downloaded_location)) {
            fs.mkdirSync(this.downloaded_location);
        }

        this.ext = is_windows ? "_x86.exe" : "_linux";
        this.version = "";
        this.repository = repository;
        this.custom_ffmpeg_location = path.resolve(location, "ffmpeg");
        this.binary_location = path.resolve(location, `yt-dlp${this.ext}`);
        this.version_location = path.resolve(location, "yt-dlp-version");
    }

    async initialize() {
        // download ffmpeg binary on windows
        await this.download_ffmpeg();

        // check if our binary already exists
        if (fs.existsSync(this.binary_location) && fs.existsSync(this.version_location)) {
            const saved_version = fs.readFileSync(this.version_location, "utf-8");
            const latest_version = await this.get_latest_version();

            // check if we're on the latest version
            if (saved_version == latest_version) {
                this.update_version(latest_version);
                return;
            }

            console.log(`dlp: detected new yt-dlp version\ndownloading: ${latest_version}`);
        } else {
            console.log("dlp: downloading latest yt-dlp binary");
        }

        // otherwise download latest version
        const new_binary = await this.download_latest_binary();

        if (!new_binary) {
            console.error("dlp: failed to download yt-dlp binary");
            return;
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
        console.log(`dlp: downloaded ${version} succesfully`);
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

    // @TODO: test on windows lol
    async download_ffmpeg() {
        // windows only
        if (process.platform != "win32" || fs.existsSync(this.custom_ffmpeg_location)) {
            return;
        }

        // ensure folder is created
        if (!fs.existsSync(this.custom_ffmpeg_location)) {
            fs.mkdirSync(this.custom_ffmpeg_location, { recursive: true });
        }

        console.log("dlp: downloading ffmpeg for windows");

        const FFMPEG_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip";
        const response = await fetch(FFMPEG_URL);
        const buffer = await response.arrayBuffer();

        // save temp zip file
        const temp_zip = path.resolve(this.temp_location, `ffmpeg_${Date.now()}.zip`);
        fs.writeFileSync(temp_zip, Buffer.from(buffer));

        const zip = new StreamZip.async({ file: temp_zip });
        const entries = await zip.entries();

        // extract only bin files
        for (const entry of Object.values(entries)) {
            if (entry.name.includes("/bin/") && !entry.isDirectory) {
                const file_name = path.basename(entry.name);
                const output_path = path.resolve(this.temp_location, file_name);

                await zip.extract(entry.name, output_path);

                // move to app folder
                const final_path = path.resolve(this.custom_ffmpeg_location, file_name);
                fs.renameSync(output_path, final_path);
            }
        }

        await zip.close();
        fs.unlinkSync(temp_zip); // cleanup

        console.log("dlp: ffmpeg extracted");
    }

    async download(url) {
        // check if the binary exists
        if (!url || !fs.existsSync(this.binary_location)) {
            return false;
        }

        // build args
        const args = [
            "-x",
            "--audio-format",
            "mp3",
            "-N",
            "6",
            "--http-chunk-size",
            "10M",
            "--paths",
            `temp:${this.temp_location}`,
            "--paths",
            `home:${this.downloaded_location}`
        ];

        // add custom ffmpeg PATH on windows
        if (is_windows) {
            args.push("--ffmpeg-location", this.custom_ffmpeg_location);
        }

        // add url
        args.push(url);

        const result = await new Promise((r) => {
            const proc = spawn(this.binary_location, args);
            let stdout_buffer = "";

            proc.stdout.on("data", (d) => {
                stdout_buffer += d.toString();
            });

            proc.stderr.on("data", () => {});

            proc.on("close", (code) => {
                if (code == 0) {
                    // get file location
                    const lines = stdout_buffer
                        .split("\n")
                        .map((l) => l.trim())
                        .filter((l) => l);
                    const move_line = lines.find((l) => l.includes("[MoveFiles]"));

                    if (!move_line) {
                        r(null);
                        return;
                    }

                    // return null if we didn't find anything
                    const audio_location = move_line.split(" to ")[1]?.replace(/^["']|["']$/g, "");

                    if (!audio_location) {
                        r(null);
                        return;
                    }

                    const audio_name = path.basename(audio_location);
                    r({ name: audio_name, location: audio_location });
                }

                r(null);
            });
        });

        return result;
    }
}

export const song_downloader = new SongDownloader("yt-dlp/yt-dlp", get_app_path());
