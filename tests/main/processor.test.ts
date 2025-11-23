import { beforeAll, describe, expect, test } from "vitest";
import { setup_config } from "../utils/utils";
import { beatmap_processor } from "@main/database/processor";
import { ProcessorInput } from "@shared/types";

import path from "path";

describe("processor", () => {
    beforeAll(() => {
        setup_config();
        beatmap_processor.initialize();
    });

    const TARGET_BEATMAP_HASH = "77b7eaacef5dda52466009b08673861f";
    const TARGET_BEATMAP_PATH = path.resolve(
        "tests",
        ".data",
        "osu",
        "Songs",
        "2403850 FRAM - Step for Joy",
        "FRAM - Step for Joy (dal4ra) [crax4ra's Insane].osu"
    );

    test("process beatmap", async () => {
        const data: ProcessorInput = {
            md5: TARGET_BEATMAP_HASH,
            file_path: TARGET_BEATMAP_PATH,
            last_modified: "penis",
            extract: ["duration", "background"]
        };

        const result = await beatmap_processor.process_beatmaps([data]);

        expect(result.success).toBe(true);
        if (!result.success) return;
        const processed_data = result.data.get("77b7eaacef5dda52466009b08673861f");
        expect(processed_data?.duration).toBeGreaterThan(1);
        expect(processed_data?.background).toBe("/home/rel/stuff/personal/osu-stuff-ts/tests/.data/osu/Songs/2403850 FRAM - Step for Joy/bg.jpg");
    });
});
