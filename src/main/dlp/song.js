import path from "path";
import fs from "fs";

import { yt_dlp, YTdlp } from "./dlp";
import { get_app_path } from "../database/utils";

// @TODO: send notification to main process on success, error, etc...

export class SongDownloader {
    constructor(location, dlp) {
        if (!dlp) {
            throw new Error("missing yt-dlp instance");
        }

        if (!location) {
            throw new Error("missing location dumbass");
        }

        this.downloaded_location = path.resolve(location, "downloaded");
        this.temp_location = path.resolve(location, "temp");

        /** @type {YTdlp} */
        this.dlp = dlp;

        if (!fs.existsSync(this.downloaded_location)) {
            fs.mkdirSync(this.downloaded_location, { recursive: true });
        }
    }

    async initialize() {
        await this.dlp.initialize();
    }

    async download(url) {
        // check if url is provided
        if (!url) {
            return false;
        }

        // build args
        const download_args = [
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
            `home:${this.downloaded_location}`,
            url
        ];

        const result = await this.dlp.exec(download_args);

        if (!result || result.code != 0) {
            return false;
        }

        // get file location from stdout
        const lines = result.stdout
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l);
        const move_line = lines.find((l) => l.includes("[MoveFiles]"));

        if (!move_line) {
            return false;
        }

        // return null if we didn't find anything
        const audio_location = move_line.split(" to ")[1]?.replace(/^["']|["']$/g, "");

        if (!audio_location) {
            return false;
        }

        const audio_name = path.basename(audio_location);
        return { name: audio_name, location: audio_location };
    }
}

export const song_downloader = new SongDownloader(get_app_path(), yt_dlp);
