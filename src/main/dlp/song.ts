import path from "path";
import fs from "fs";

import { yt_dlp, YTdlp } from "./dlp";
import { get_app_path } from "../database/utils";
import { GenericResult } from "@shared/types";

// @TODO: send notification to main process on success, error, etc...

type MetadataResult = Map<string, string>;

export class SongDownloader {
    downloaded_location: string;
    temp_location: string;
    dlp: YTdlp;

    constructor(location: string, dlp: YTdlp) {
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

    async download(url: string): Promise<GenericResult<MetadataResult>> {
        if (!url) {
            return { success: false, reason: "missing url" };
        }

        // build args
        const download_args = [
            "-x",
            "--audio-format",
            "mp3",
            "--http-chunk-size",
            "10M",
            "--external-downloader",
            "aria2c",
            "-P",
            this.downloaded_location,
            "-o",
            "%(title)s.%(ext)s",
            url
        ];

        console.log("dlp: using args:", download_args.join(" "));

        const result = await this.dlp.exec(download_args);

        if (!result.success) {
            console.log("dlp: failed to exec:", result.reason);
            return { success: false, reason: "failed to exec" };
        }

        const info_args = ["--print", "title=%(title)s\ncreator=%(uploader)s\nthumb=%(thumbnail)s", url];
        const info_result = await this.dlp.exec(info_args);

        if (!info_result.success) {
            return { success: false, reason: "failed to exec" };
        }

        // get metadata from result
        const data = info_result.data.stdout.split("\n");
        const metadata: MetadataResult = new Map(
            data
                .map((line) => line.trim())
                .filter((line) => line.includes("="))
                .map((line) => {
                    let [key, ...rest] = line.split("=");
                    let value = rest.join("=");
                    return [key.trim(), value.trim()];
                })
        );

        // @TODO: consider custom extension later
        const file_location = path.resolve(this.downloaded_location, `${metadata.get("title")}.mp3`);
        metadata.set("location", file_location);

        return { success: true, data: metadata };
    }
}

export const song_downloader = new SongDownloader(get_app_path(), yt_dlp);
