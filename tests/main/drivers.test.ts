import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { get_driver } from "@main/database/drivers/driver";
import { create_temp_beatmap } from "../utils/utils";
import { setup_config } from "../utils/utils";

const temp_beatmap = create_temp_beatmap();

const test_driver = (type: string) => {
    const driver = get_driver(type);
    const temp_collection_name = String(Date.now());
    const test_beatmapset_id = 1326501; // title: dallas
    const test_beatmap_id = 2953473; // diff: height of the summer

    // NOTE: both lazer and stable test files include the same beatmaps
    // however lazer seems to count the intro as a beatmap? idk
    const BEATMAP_COUNT = type == "lazer" ? 48 : 47;

    beforeAll(() => {
        driver.initialize();
    });

    afterAll(() => {
        // cleanup: remove temp beatmap and collection
        driver.delete_collection(temp_collection_name);
    });

    test(`${type}: initialize():`, async () => {
        await driver.initialize(true);
        // @ts-ignore: accessing protected property for testing
        expect(driver.initialized).toBe(true);
    }, 15000);

    test(`${type}: add_collection():`, () => {
        const result = driver.add_collection(temp_collection_name, ["123", "321"]);
        expect(result).toBe(true);
        // verify its in memory
        const collection = driver.get_collection(temp_collection_name);
        expect(collection).toBeDefined();
        expect(collection?.beatmaps).toEqual(["123", "321"]);
    });

    test(`${type}: get_collections():`, () => {
        const collections = driver.get_collections();
        expect(collections).toBeDefined();
        const result = collections.find((c) => c.name == temp_collection_name);
        expect(result).toBeDefined();
    });

    test(`${type}: get_collection(generated):`, async () => {
        // TOFIX: use the same name for both drivers (need to generate shit again)...
        const result = driver.get_collection("glass beach");
        expect(result).toBeDefined();
    });

    test(`${type}: delete_collection(temp):`, () => {
        const result = driver.delete_collection(temp_collection_name);
        expect(result).toBe(true);
        const find_result = driver.get_collection(temp_collection_name);
        expect(find_result).toBeUndefined();
    });

    test(`${type}: get_all_beatmaps():`, async () => {
        const result = driver.get_beatmaps();
        expect(result.length).toBe(BEATMAP_COUNT);
    });

    test(`${type}: add_beatmap(temp):`, () => {
        const result = driver.add_beatmap(temp_beatmap);
        expect(result).toBe(true);
    });

    test(`${type}: get_beatmap(temp):`, async () => {
        const result = await driver.get_beatmap_by_md5(temp_beatmap.md5);
        expect(result).toBe(temp_beatmap);
    });

    test(`${type}: get_all_beatmaps(including temp):`, async () => {
        const result = driver.get_beatmaps();
        expect(result.length).toBe(BEATMAP_COUNT + 1);
    });

    // temp beatmaps persist across searches
    test(`${type}: temp beatmaps persist across searches:`, async () => {
        const { beatmaps } = await driver.search_beatmaps({
            query: temp_beatmap.title,
            sort: "title",
            unique: false
        });

        expect(beatmaps.find((b) => b.md5 === temp_beatmap.md5)).toBeDefined();
    });

    test(`${type}: get_beatmapset():`, async () => {
        const result = await driver.get_beatmapset(test_beatmapset_id);
        expect(result).toBeDefined();
        expect(result?.metadata.title).toBe("dallas");
    });

    test(`${type}: get_beatmap_by_id()):`, async () => {
        const result = await driver.get_beatmap_by_id(test_beatmap_id);
        expect(result).toBeDefined();
        expect(result?.difficulty).toBe("height of the summer");
    });

    test(`${type}: search_beatmaps():`, async () => {
        const { beatmaps } = await driver.search_beatmaps({
            query: `artist="glass beach"`,
            sort: "title",
            unique: false
        });

        expect(beatmaps.length).toBe(18);
    });

    test(`${type}: get_beatmap_files():`, async () => {
        const result = await driver.get_beatmapset_files(test_beatmapset_id);
        expect(result.length).toBeGreaterThan(1);
    });

    test(`${type}: fetch_beatmaps():`, async () => {
        const beatmaps = driver.get_beatmaps();
        const result = await driver.fetch_beatmaps(beatmaps.map((b) => b.md5));
        expect(result.beatmaps.some((b) => b.md5 == undefined)).toBe(false);
    });

    test(`${type}: fetch_beatmapsets():`, async () => {
        const beatmapsets = driver.get_beatmapsets();
        const result = await driver.fetch_beatmapsets(beatmapsets.map((b) => b.online_id));
        expect(result.beatmaps.some((b) => b.online_id == undefined)).toBe(false);
    });

    // REMEMBER: check structure / integrity when i finish the beatmap parser
    test(`${type}: export_beatmapset():`, async () => {
        const result = await driver.export_beatmapset(test_beatmapset_id);
        expect(result).toBe(true);
    });
};

describe("osu!driver", () => {
    beforeAll(async () => {
        await setup_config();
    });

    describe("lazer", () => test_driver("lazer"));
    describe("stable", () => test_driver("stable"));
});
