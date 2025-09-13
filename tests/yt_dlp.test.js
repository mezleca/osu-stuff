import fs from "fs";
import path from "path";

import { describe, expect, test } from "bun:test";
import { TEST_TARGET_PATH, clean_test_path } from "./utils/utils";
import { YTdlp } from "../src/main/dlp/dlp";
import { SongDownloader } from "../src/main/dlp/song";

const TARGET_YT_SONG = "https://www.youtube.com/watch?v=KJotmmDJWAg";

// create new yt_dlp instance
const new_instance = new YTdlp(TEST_TARGET_PATH);

describe("yt-dlp", async () => {
    // ensure we initialize with a empty test path
    await clean_test_path();

    test(
        "initialize new yt-dlp instance",
        async () => {
            const result = await new_instance.initialize();
            expect(result).toBe(true);
        },
        { timeout: 20000 }
    );

    test("check downloaded binaries", () => {
        const target_binary = new_instance.name;
        const file_exists = fs.existsSync(path.resolve(TEST_TARGET_PATH, target_binary));

        expect(file_exists).toBe(true);

        // only test ffmpeg on windows
        if (process.platform == "win32") {
            let target_binaries = ["ffmpeg.exe", "ffplay.exe", "ffprobe.exe"];

            const ffmpeg_folder_exists = fs.existsSync(path.resolve(TEST_TARGET_PATH, "ffmpeg"));
            expect(ffmpeg_folder_exists).toBe(true);

            if (ffmpeg_folder_exists) {
                const ffmpeg_binaries = fs.readdirSync(path.resolve(TEST_TARGET_PATH, "ffmpeg"));

                // vheck if all required binaries exist
                const all_binaries_exist = target_binaries.every((target) => ffmpeg_binaries.some((b) => b.includes(target.replace(".exe", ""))));

                expect(all_binaries_exist).toBe(true);
            }
        }
    });

    // test if binary is executable and returns version info
    test(
        "yt-dlp binary is functional",
        async () => {
            const result = await new_instance.exec(["--version"]);
            console.log(result);
            expect(result).toBeObject();
            expect(result.code).toBe(0);
        },
        { timeout: 10000 }
    );
});

describe("song downloader", () => {
    // create new instance
    const song_downloader = new SongDownloader(TEST_TARGET_PATH, new_instance);

    test(
        "initialize new song download instance",
        async () => {
            await song_downloader.initialize();

            // test that the downloader was properly initialized
            expect(song_downloader.dlp.is_binary_available()).toBe(true);
            expect(fs.existsSync(song_downloader.downloaded_location)).toBe(true);
        },
        { timeout: 1000 }
    );

    test(
        "download random youtube song",
        async () => {
            const result = await song_downloader.download(TARGET_YT_SONG);

            // check if result is not false/null
            expect(result).not.toBe(false);
            expect(result).not.toBe(null);

            const obj = Object.fromEntries(result);

            // check if result has expected properties
            expect(obj).toHaveProperty("title");
            expect(obj).toHaveProperty("creator");
            expect(obj).toHaveProperty("location");
            expect(typeof obj.title).toBe("string");
            expect(typeof obj.creator).toBe("string");
            expect(typeof obj.location).toBe("string");

            // check if downloaded file exists
            expect(fs.existsSync(obj.location)).toBe(true);

            // check if file has some content
            const stats = fs.statSync(obj.location);
            expect(stats.size).toBeGreaterThan(0);
        },
        { timeout: 30000 }
    );

    test(
        "download with invalid URL",
        async () => {
            const result = await song_downloader.download("invalid url");
            expect(result).toBe(false);
        },
        { timeout: 10000 }
    );

    test(
        "download without URL",
        async () => {
            const result = await song_downloader.download();
            expect(result).toBe(false);
        },
        { timeout: 1000 }
    );
});
