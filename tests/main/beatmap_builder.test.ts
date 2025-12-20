import { describe, expect, test } from "vitest";
import { TEMP_DIR, setup_config } from "../utils/utils";
import { BeatmapBuilder } from "@main/beatmaps/builder";

import fs from "fs";
import path from "path";

const AUDIO_LOCATION = path.resolve("tests", "utils", "audio.mp3");
const IMAGE_LOCATION = path.resolve("tests", "utils", "bg.jpg");

describe("builder", async () => {
    beforeAll(async () => {
        await setup_config();
    });

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
        const test_osu_file = path.join(TEMP_DIR, "test_beatmap.osu");
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

    test("handle invalid audio file path", () => {
        const invalidAudioBeatmap = builder.create();
        const INVALID_AUDIO_LOCATION = path.resolve(__dirname, "utils", "nonexistent_audio.mp3");
        expect(() => {
            invalidAudioBeatmap.set_audio(INVALID_AUDIO_LOCATION);
        }).toThrow();
    });

    test("handle invalid image file path", () => {
        const invalidImageBeatmap = builder.create();
        const INVALID_IMAGE_LOCATION = path.resolve(__dirname, "utils", "nonexistent_bg.jpg");
        expect(() => {
            invalidImageBeatmap.set_image(INVALID_IMAGE_LOCATION);
        }).toThrow();
    });

    test("create zip with all files", async () => {
        const zip_buffer = await builder.zip(beatmap);

        expect(zip_buffer.success).toBe(true);
        if (!zip_buffer.success) return;

        expect(Buffer.isBuffer(zip_buffer.data)).toBe(true);

        // optionally save and verify zip contents
        const test_zip_path = path.join(TEMP_DIR, "test_beatmap.osz");
        fs.writeFileSync(test_zip_path, zip_buffer.data);
        expect(fs.existsSync(test_zip_path)).toBe(true);
    });

    test("should throw on missing required fields", () => {
        const empty_beatmap = builder.create();

        expect(() => {
            builder.write(empty_beatmap);
        }).toThrow("missing AudioFilename");
    });
});
