import { describe, expect, test } from "vitest";
import { get_driver } from "../../src/main/drivers/driver";
import { create_temp_beatmap, setup_config } from "../utils/utils";

const test_driver = (type: string) => {
    const driver = get_driver(type);
    const temp_collection_name = String(Date.now());
    const temp_beatmap = create_temp_beatmap();
    const test_beatmapset_id = 1326501; // title: dallas
    const test_beatmap_id = 2953473; // diff: height of the summer

    // NOTE: both lazer and stable test files include the same beatmaps
    // however lazer seems to count the intro as a beatmap? idk
    const BEATMAP_COUNT = type == "lazer" ? 48 : 47;

    test(`${type}: initialize():`, async () => {
        expect(driver.initialize).not.throw();
    });

    test(`${type}: add_collection():`, async () => {
        const result = driver.add_collection(temp_collection_name, ["123", "321"]);
        expect(result).toBe(true);
    });

    test(`${type}: get_collections():`, async () => {
        const collections = driver.get_collections();
        expect(collections).toBeDefined();
        const result = collections.find((c) => c.name == temp_collection_name);
        expect(result).toBeDefined();
    });

    test(`${type}: get_collection(generated):`, async () => {
        // TOFIX: use the same name for both drivers (need to generate shit again)...
        const result = await driver.get_collection("glass beach");
        expect(result).toBeDefined();
    });

    test(`${type}: delete_collection(temp):`, () => {
        const result = driver.delete_collection(temp_collection_name);
        expect(result).toBe(true);
        const find_result = driver.get_collection(temp_collection_name);
        expect(find_result).toBeUndefined();
    });

    test(`${type}: get_all_beatmaps():`, async () => {
        const result = await driver.get_all_beatmaps();
        expect(result.length).toBe(BEATMAP_COUNT);
    });

    test(`${type}: add_beatmap(temp):`, async () => {
        const result = driver.add_beatmap(temp_beatmap);
        expect(result).toBe(true);
    });

    test(`${type}: get_beatmap(temp):`, async () => {
        const result = await driver.get_beatmap_by_md5(temp_beatmap.md5);
        expect(result).toBe(temp_beatmap);
    });

    test(`${type}: get_all_beatmaps(including temp):`, async () => {
        const result = await driver.get_all_beatmaps();
        expect(result.length).toBe(BEATMAP_COUNT + 1);
    });

    // TODO
    test(`${type}: remove_beatmap(temp):`, async () => {});

    test(`${type}: get_beatmapset():`, async () => {
        const result = await driver.get_beatmapset(test_beatmapset_id);
        expect(result).toBeDefined();
        expect(result.metadata.title).toBe("dallas");
    });

    test(`${type}: get_beatmap_by_id()):`, async () => {
        const result = await driver.get_beatmap_by_id(test_beatmap_id);
        expect(result).toBeDefined();
        expect(result.difficulty).toBe("height of the summer");
    });

    test(`${type}: search_beatmaps():`, async () => {
        if (type == "web") {
            // TODO
        } else {
            const result = await driver.search_beatmaps({
                query: `artist="glass beach"`
            });

            expect(result.length).toBe(18);
        }
    });

    test(`${type}: get_beatmap_files():`, async () => {
        const result = await driver.get_beatmapset_files(test_beatmapset_id);
        expect(result.length).toBeGreaterThan(1);
    });

    test(`${type}: fetch_beatmaps():`, async () => {
        const beatmaps = await driver.get_all_beatmaps();
        const result = await driver.fetch_beatmaps(beatmaps);
        expect(result.some((b) => b.md5 == undefined)).toBe(false);
    });
};

describe("osu!drivers", async () => {
    setup_config();
    test_driver("lazer");
    test_driver("stable");
});
