import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { get_driver } from "@main/database/drivers/driver";
import { create_temp_beatmap } from "../utils/utils";
import { cached_beatmaps } from "@main/beatmaps/beatmaps";

// NOTE:
// these are the tests for osu! driver
// no mock shit, real files, real beatmaps
// theres still a lot to be done here
// especially because most of the tests dont really test anything other than return type?

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
        // TODO: driver.remove_beatmap(temp_beatmap.md5);
    });

    test(`${type}: initialize():`, () => {
        expect(driver.initialize).not.throw();
    });

    test(`${type}: add_collection():`, () => {
        const result = driver.add_collection(temp_collection_name, ["123", "321"]);
        expect(result).toBe(true);
    });

    test(`${type}: get_collections():`, () => {
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
        const result = await driver.get_beatmaps();
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
        const result = await driver.get_beatmaps();
        expect(result.length).toBe(BEATMAP_COUNT + 1);
    });

    // TODO: move logic to osu driver
    test(`${type}: remove_beatmap(temp):`, async () => {
        cached_beatmaps.delete(temp_beatmap.md5);
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
            show_invalid: true,
            unique: false
        });

        expect(beatmaps.length).toBe(18);
    });

    test(`${type}: get_beatmap_files():`, async () => {
        const result = await driver.get_beatmapset_files(test_beatmapset_id);
        expect(result.length).toBeGreaterThan(1);
    });

    test(`${type}: fetch_beatmaps():`, async () => {
        const beatmaps = await driver.get_beatmaps();
        const result = await driver.fetch_beatmaps(beatmaps.map((b) => b.md5));
        expect(result.some((b) => b.md5 == undefined)).toBe(false);
    });

    test(`${type}: fetch_beatmapsets():`, async () => {
        const beatmapsets = await driver.get_beatmapsets();
        const result = await driver.fetch_beatmapsets(beatmapsets.map((b) => b.id));
        expect(result.some((b) => b.online_id == undefined)).toBe(false);
    });

    // REMEMBER: check structure / integrity when i finish the beatmap parser
    test(`${type} export_beatmapset():`, async () => {
        const result = await driver.export_beatmapset(test_beatmapset_id);
        expect(result).toBe(true);
    });
};

describe("osu!drivers", () => {
    describe("lazer", () => test_driver("lazer"));
    describe("stable", () => test_driver("stable"));
});
