import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { get_client } from "@main/osu/clients/client";
import { matches_beatmap, parse_query } from "@main/osu/beatmaps";
import { OsuDbParser } from "@main/osu/parsers";
import { create_temp_beatmap, TEMP_DIR } from "../utils/utils";
import { setup_config } from "../utils/utils";
import { GameMode, ALL_STATUS_KEY, IBeatmapResult } from "@shared/types";
import path from "path";
import { performance } from "node:perf_hooks";

const temp_beatmap = create_temp_beatmap();

const test_client = (type: string) => {
    const client = get_client(type);
    const temp_collection_name = String(Date.now());
    const test_beatmapset_id = 1326501; // title: dallas
    const test_beatmap_id = 2953473; // diff: height of the summer

    // NOTE: both lazer and stable test files include the same beatmaps
    // however lazer seems to count the intro as a beatmap? idk
    const BEATMAP_COUNT = type == "lazer" ? 48 : 47;

    beforeAll(async () => {
        await client.initialize();
    });

    afterAll(() => {
        // cleanup: remove temp beatmap and collection
        client.delete_collection(temp_collection_name);
    });

    test(`${type}: initialize():`, async () => {
        await client.initialize(true);
        // @ts-ignore: accessing protected property for testing
        expect(client.initialized).toBe(true);
    }, 15000);

    if (type == "stable") {
        test(`${type}: osu_db get helpers`, () => {
            // @ts-ignore: accessing protected property for testing
            const parser = client.osu_db_parser;
            const header = parser.get_header();
            expect(header.beatmaps_count).toBeGreaterThan(0);

            const first = parser.get_minimal_list()[0];
            expect(first).toBeDefined();

            const by_md5 = parser.filter_by_properties({ md5: first.md5 });
            expect(by_md5.length).toBe(1);
            expect(by_md5[0]?.md5).toBe(first.md5);

            const by_set = parser.filter_by_properties({ beatmap_id: first.beatmap_id });
            expect(by_set.length).toBeGreaterThan(0);

            const by_diff = parser.filter_by_properties({ difficulty_id: first.difficulty_id });
            expect(by_diff.length).toBe(1);
            expect(by_diff[0]?.md5).toBe(first.md5);
        });

        test(`${type}: benchmark parse/filter`, async () => {
            const osu_db_location = path.resolve(TEMP_DIR, "osu", "osu!.db");

            const parse_start = performance.now();
            const parser = new OsuDbParser();
            await parser.parse(osu_db_location);
            const parse_elapsed = performance.now() - parse_start;

            const filter_start = performance.now();
            const filtered = parser.filter_by_properties({
                query: "glass beach",
                sort: { key: "title", order: "asc" },
                star_rating: { min: 4, max: 10 }
            });
            const filter_elapsed = performance.now() - filter_start;

            console.info(
                `[benchmark][stable] parse_osu_db_ms=${parse_elapsed.toFixed(3)} filter_ms=${filter_elapsed.toFixed(3)} result=${filtered.length}`
            );

            expect(parse_elapsed).toBeGreaterThanOrEqual(0);
            expect(filter_elapsed).toBeGreaterThanOrEqual(0);
            expect(filtered.length).toBeGreaterThanOrEqual(0);
            parser.free();
        });
    }

    test(`${type}: add_collection():`, () => {
        const result = client.add_collection(temp_collection_name, ["123", "321"]);
        expect(result).toBe(true);
        // verify its in memory
        const collection = client.get_collection(temp_collection_name);
        expect(collection).toBeDefined();
        expect(collection?.beatmaps).toEqual(["123", "321"]);
        expect((collection?.last_modified ?? 0) > 0).toBe(true);
    });

    test(`${type}: add_beatmaps_to_collection():`, async () => {
        const collection = client.get_collection(temp_collection_name);
        expect(collection).toBeDefined();

        const before = collection?.last_modified ?? 0;
        await new Promise((resolve) => setTimeout(resolve, 5));

        const result = client.add_beatmaps_to_collection(temp_collection_name, ["999"]);
        expect(result).toBe(true);

        const updated = client.get_collection(temp_collection_name);
        expect(updated?.beatmaps.includes("999")).toBe(true);
        expect((updated?.last_modified ?? 0) > before).toBe(true);
    });

    test(`${type}: get_collections():`, () => {
        const collections = client.get_collections();
        expect(collections).toBeDefined();
        const result = collections.find((c) => c.name == temp_collection_name);
        expect(result).toBeDefined();
    });

    test(`${type}: update_collection() resets last_modified:`, async () => {
        const result = await client.update_collection();
        expect(result).toBe(true);

        const collection = client.get_collection(temp_collection_name);
        expect(collection).toBeDefined();
        expect(collection?.last_modified).toBe(0);
    });

    test(`${type}: get_collection(generated):`, async () => {
        // TOFIX: use the same name for both clients (need to generate data again)...
        const result = client.get_collection("glass beach");
        expect(result).toBeDefined();
    });

    test(`${type}: delete_collection(temp):`, () => {
        const result = client.delete_collection(temp_collection_name);
        expect(result).toBe(true);
        const find_result = client.get_collection(temp_collection_name);
        expect(find_result).toBeUndefined();
    });

    test(`${type}: get_all_beatmaps():`, async () => {
        const result = client.get_beatmaps();
        expect(result.length).toBe(BEATMAP_COUNT);
    });

    test(`${type}: add_beatmap(temp):`, () => {
        const result = client.add_beatmap(temp_beatmap);
        expect(result).toBe(true);
    });

    test(`${type}: get_beatmap(temp):`, async () => {
        const result = await client.get_beatmap_by_md5(temp_beatmap.md5);
        expect(result).toBe(temp_beatmap);
    });

    test(`${type}: get_all_beatmaps(including temp):`, async () => {
        const result = client.get_beatmaps();
        expect(result.length).toBe(BEATMAP_COUNT + 1);
    });

    // temp beatmaps persist across searches
    test(`${type}: temp beatmaps persist across searches:`, async () => {
        const { beatmaps } = await client.search_beatmaps({
            query: temp_beatmap.title,
            sort: "title",
            status: ALL_STATUS_KEY,
            mode: GameMode.All,
            unique: false
        });

        expect(beatmaps.find((b) => b.md5 === temp_beatmap.md5)).toBeDefined();
    });

    test(`${type}: get_beatmapset():`, async () => {
        const result = await client.get_beatmapset(test_beatmapset_id);
        expect(result).toBeDefined();
        expect(result?.metadata.title).toBe("dallas");
    });

    test(`${type}: get_beatmap_by_id()):`, async () => {
        const result = await client.get_beatmap_by_id(test_beatmap_id);
        expect(result).toBeDefined();
        expect(result?.difficulty).toBe("height of the summer");
    });

    test(`${type}: search_beatmaps():`, async () => {
        const { beatmaps } = await client.search_beatmaps({
            query: `artist="glass beach"`,
            sort: "title",
            status: ALL_STATUS_KEY,
            mode: GameMode.All,
            unique: false
        });

        expect(beatmaps.length).toBe(18);
    });

    test(`${type}: search_beatmapsets():`, async () => {
        const { beatmapsets } = await client.search_beatmapsets({
            query: "glass beach",
            sort: "artist",
            status: ALL_STATUS_KEY,
            mode: GameMode.All
        });

        expect(beatmapsets.length).toBeGreaterThan(0);
    });

    test(`${type}: get_beatmap_files():`, async () => {
        const result = await client.get_beatmapset_files(test_beatmapset_id);
        expect(result.length).toBeGreaterThan(1);
    });

    test(`${type}: fetch_beatmaps():`, async () => {
        const beatmaps = client.get_beatmaps();
        const result = await client.fetch_beatmaps(beatmaps.map((b) => b.md5));
        expect(result.beatmaps.some((b) => b.md5 == undefined)).toBe(false);
    });

    test(`${type}: fetch_beatmapsets():`, async () => {
        const beatmapsets = client.get_beatmapsets();
        const result = await client.fetch_beatmapsets(beatmapsets.map((b) => b.online_id));
        expect(result.beatmaps.some((b) => b.online_id == undefined)).toBe(false);
    });

    // REMEMBER: check structure / integrity when i finish the beatmap parser
    test(`${type}: export_beatmapset():`, async () => {
        const result = await client.export_beatmapset(test_beatmapset_id);
        expect(result).toBe(true);
    });
};

describe("osu!client", () => {
    beforeAll(async () => {
        await setup_config();
    }, 120000);

    describe("lazer", () => test_client("lazer"));
    describe("stable", () => test_client("stable"));
});

const make_query_beatmap = (overrides: Partial<IBeatmapResult> = {}): IBeatmapResult => ({
    md5: "md5",
    online_id: 1,
    beatmapset_id: 2,
    title: "Senorita",
    artist: "Camellia",
    creator: "Mapper",
    difficulty: "Insane",
    source: "",
    tags: "electronic test",
    ar: 9,
    cs: 4,
    hp: 6,
    od: 8,
    star_rating: 5.5,
    bpm: 180,
    length: 120,
    status: "ranked",
    mode: GameMode.Osu,
    temp: false,
    last_modified: "0",
    background: "",
    duration: 120,
    audio: "",
    ...overrides
});

describe("beatmap query", () => {
    test("supports wiki-style aliases/operators and normalized text search", () => {
        const beatmap = make_query_beatmap({
            title: "Señorita",
            creator: "rel",
            difficulty: "Another",
            star_rating: 6.3,
            hp: 7,
            mode: GameMode.Catch,
            status: "ranked"
        });

        const valid_queries = [
            "senorita",
            "AR>=9",
            'author:"rel" diff:another sr>=6 dr==7',
            'mapper:"rel" stars>=6 mode=catch status=ranked',
            "status=ranked,loved"
        ];

        for (const raw of valid_queries) {
            expect(matches_beatmap(beatmap, parse_query(raw))).toBe(true);
        }
    });

    test("unknown keys become text and invalid filters fail", () => {
        const beatmap = make_query_beatmap({ title: "my song x", status: "ranked" });

        expect(matches_beatmap(beatmap, parse_query("foo:x"))).toBe(true);
        expect(matches_beatmap(beatmap, parse_query("sr>=10"))).toBe(false);
        expect(matches_beatmap(beatmap, parse_query("mode=mania"))).toBe(false);
        expect(matches_beatmap(beatmap, parse_query("status!=ranked,loved"))).toBe(false);
    });

    test("benchmark parse_query/matches_beatmap", () => {
        const beatmap = make_query_beatmap({
            title: "Señorita",
            creator: "rel",
            difficulty: "Another",
            star_rating: 6.3,
            hp: 7,
            mode: GameMode.Catch,
            status: "ranked"
        });

        const input_query = 'mapper:"rel" stars>=6 mode=catch status=ranked';
        const loops = 2000;

        const parse_start = performance.now();
        for (let i = 0; i < loops; i++) {
            parse_query(input_query);
        }
        const parse_elapsed = performance.now() - parse_start;

        const parsed = parse_query(input_query);
        const match_start = performance.now();
        let matched_count = 0;

        for (let i = 0; i < loops; i++) {
            if (matches_beatmap(beatmap, parsed)) {
                matched_count++;
            }
        }

        const match_elapsed = performance.now() - match_start;
        console.info(
            `[benchmark][query] parse_ms=${parse_elapsed.toFixed(3)} match_ms=${match_elapsed.toFixed(3)} loops=${loops} matches=${matched_count}`
        );

        expect(parse_elapsed).toBeGreaterThanOrEqual(0);
        expect(match_elapsed).toBeGreaterThanOrEqual(0);
        expect(matched_count).toBe(loops);
    });
});
