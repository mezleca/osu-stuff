import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { get_driver } from "@main/database/drivers/driver";
import { create_temp_beatmap } from "../utils/utils";
import { cached_beatmaps } from "@main/beatmaps/beatmaps";
import { DriverActionType } from "@shared/types";
import { read_legacy_collection } from "../../src/main/binary/stable";
import { setup_config } from "../utils/utils";

import path from "path";

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

    test(`${type}: initialize():`, async () => {
        await driver.initialize(true);
        // @ts-ignore: accessing protected property for testing
        expect(driver.initialized).toBe(true);
    });

    test(`${type}: add_collection():`, () => {
        const result = driver.add_collection(temp_collection_name, ["123", "321"]);
        expect(result).toBe(true);
        // verify its in memory
        const collection = driver.get_collection(temp_collection_name);
        expect(collection).toBeDefined();
        // verify action
        const action = driver.actions.find((a) => a.type == 0 && "name" in a && a.name == temp_collection_name);
        expect(action).toBeDefined();
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
        // verify action
        const action = driver.actions.find((a) => a.type == 1 && "name" in a && a.name == temp_collection_name);
        expect(action).toBeDefined();
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
        expect(result.beatmaps.some((b) => b.md5 == undefined)).toBe(false);
    });

    test(`${type}: fetch_beatmapsets():`, async () => {
        const beatmapsets = await driver.get_beatmapsets();
        const result = await driver.fetch_beatmapsets(beatmapsets.map((b) => b.id));
        expect(result.beatmaps.some((b) => b.online_id == undefined)).toBe(false);
    });

    // REMEMBER: check structure / integrity when i finish the beatmap parser
    test(`${type} export_beatmapset():`, async () => {
        const result = await driver.export_beatmapset(test_beatmapset_id);
        expect(result).toBe(true);
    });
};

const test_actions = (type: string) => {
    const driver = get_driver(type);
    const test_collection_name = "action_test_collection";

    test(`${type} actions are logged on add_collection`, () => {
        const initial_actions_count = driver.get_actions().length;
        driver.add_collection(test_collection_name, []);

        const actions = driver.get_actions();
        expect(actions.length).toBe(initial_actions_count + 1);

        const last_action = actions[actions.length - 1] as any;
        expect(last_action.type).toBe(DriverActionType.Add);
        expect(last_action.name).toBe(test_collection_name);
    });

    test(`${type} actions are logged on rename_collection`, () => {
        const new_name = "renamed_action_test";
        const initial_actions_count = driver.get_actions().length;

        driver.rename_collection(test_collection_name, new_name);

        const actions = driver.get_actions();
        expect(actions.length).toBe(initial_actions_count + 1);

        const last_action = actions[actions.length - 1] as any;
        expect(last_action.type).toBe(DriverActionType.Rename);
        expect(last_action.name).toBe(test_collection_name);
        expect(last_action.new_name).toBe(new_name);
    });

    test(`${type} actions are logged on delete_collection`, () => {
        const initial_actions_count = driver.get_actions().length;

        driver.delete_collection("renamed_action_test");

        const actions = driver.get_actions();
        expect(actions.length).toBe(initial_actions_count + 1);

        const last_action = actions[actions.length - 1] as any;
        expect(last_action.type).toBe(DriverActionType.Delete);
        expect(last_action.name).toBe("renamed_action_test");
    });

    test(`${type} remove_action works correctly`, () => {
        const actions_before = driver.get_actions().length;

        // remove last action
        const removed = driver.remove_action(actions_before - 1);
        expect(removed).toBe(true);

        const actions_after = driver.get_actions();
        expect(actions_after.length).toBe(actions_before - 1);

        // test invalid index
        const invalid_removal = driver.remove_action(999);
        expect(invalid_removal).toBe(false);
    });

    if (type === "stable") {
        test(`${type} update_collection persists changes to disk`, async () => {
            // create a new collection and update
            const persist_test_name = "persist_test_collection";

            expect(driver.add_collection(persist_test_name, [])).toBe(true);
            expect(driver.update_collection()).toBe(true);

            // check file integrity after write
            const temp_data_path = path.resolve("tests", ".temp_data", "osu", "collection.db");
            const collections_from_disk = read_legacy_collection(temp_data_path);

            console.log(collections_from_disk);

            expect(collections_from_disk.success).toBe(true);

            if (collections_from_disk.success) {
                const collection_names = Array.from(collections_from_disk.data.keys());
                expect(collection_names).toContain(persist_test_name);
            }

            // cleanup
            driver.delete_collection(persist_test_name);
            driver.update_collection();
        });
    }
};

describe("osu!driver", () => {
    beforeAll(() => {
        setup_config();
    });

    describe("lazer", () => test_driver("lazer"));
    describe("stable", () => test_driver("stable"));

    describe("actions", () => {
        describe("lazer", () => test_actions("lazer"));
        describe("stable", () => test_actions("stable"));
    });
});
