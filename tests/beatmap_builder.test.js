import fs from "fs";
import path from "path";
import { describe, expect, test } from "bun:test";
import { TEST_TARGET_PATH, clean_test_path } from "./utils/utils";
import { BeatmapBuilder } from "../src/main/beatmaps/builder";

const AUDIO_LOCATION = path.resolve(__dirname, "utils", "audio.mp3");
const IMAGE_LOCATION = path.resolve(__dirname, "utils", "bg.jpg");

describe("builder", async () => {
    await clean_test_path();

    // create new builder instance
    const builder = new BeatmapBuilder();
    const beatmap = builder.create();

    test("build new beatmap from files", () => {
        beatmap.set("Artist", "Leaf");
        beatmap.set("Title", "idk");
        beatmap.set_audio(AUDIO_LOCATION);
        beatmap.set_image(IMAGE_LOCATION);

        // ensure all properties are valid
        expect(beatmap.get("Artist")).toBe("Leaf");
        expect(beatmap.get("Title")).toBe("idk");
        expect(beatmap.get("AudioFilename")).toBe(AUDIO_LOCATION);
        expect(beatmap.get_image()).toBe("bg.jpg"); // should be just filename
    });

    test("write beatmap to .osu format", () => {
        const osu_content = builder.write(beatmap);

        // temp
        const test_osu_file = path.join(TEST_TARGET_PATH, "test_beatmap.osu");
        fs.writeFileSync(test_osu_file, osu_content, "utf-8");

        // check if contains required sections
        expect(osu_content).toContain("[General]");
        expect(osu_content).toContain("[Metadata]");
        expect(osu_content).toContain("[Difficulty]");

        // check if audio filename is basename only
        expect(osu_content).toContain("AudioFilename:audio.mp3");
        expect(osu_content).not.toContain(AUDIO_LOCATION); // shouldnt contain full path

        // check if background is valid
        expect(osu_content).toContain(`0,0,"bg.jpg"`);

        // check metadata
        expect(osu_content).toContain("Artist:Leaf");
        expect(osu_content).toContain("Title:idk");
    });

    test("create zip with all files", () => {
        const zip_buffer = builder.zip(beatmap);

        expect(zip_buffer).toBeTruthy();
        expect(Buffer.isBuffer(zip_buffer)).toBe(true);
        expect(zip_buffer.length).toBeGreaterThan(0);

        // optionally save and verify zip contents
        const test_zip_path = path.join(TEST_TARGET_PATH, "test_beatmap.osz");
        fs.writeFileSync(test_zip_path, zip_buffer);
        expect(fs.existsSync(test_zip_path)).toBe(true);

        // cleanup
        // clean_test_path();
    });

    test("should throw on missing required fields", () => {
        const empty_beatmap = builder.create();

        expect(() => {
            builder.write(empty_beatmap);
        }).toThrow("missing AudioFilename");
    });
});
