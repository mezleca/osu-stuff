#include <catch2/catch_test_macros.hpp>

#include "../src/parser/legacy/legacy.hpp"
#include "../src/parser/legacy/legacy_collection.hpp"
#include "test_helper.hpp"

#include <algorithm>

TEST_CASE("legacy parser read osu.db", "[parsers][legacy]") {
    OsuLegacyDatabase database;
    auto path = test_helper::osu_root() / "osu!.db";

    REQUIRE(legacy_parser::parse(path, &database));
    REQUIRE(database.player_name == "mzle");
    REQUIRE(database.beatmaps_count == 47);
    REQUIRE(database.beatmaps.size() == 47);

    const auto& beatmap = database.beatmaps.front();
    REQUIRE(beatmap.artist == "FRAM");
    REQUIRE(beatmap.title == "Step for Joy");
    REQUIRE(beatmap.difficulty == "crax4ra's Insane");
    REQUIRE(beatmap.md5 == "8e66c5e88adb59774e4eccca702fe242");
}

TEST_CASE("legacy parser roundtrip preserves osu db payload", "[parsers][legacy]") {
    OsuLegacyDatabase original;
    auto input_path = test_helper::osu_root() / "osu!.db";
    REQUIRE(legacy_parser::parse(input_path, &original));

    const auto output_path = test_helper::temp_root() / "legacy-roundtrip.osu!.db";
    std::filesystem::remove(output_path);
    REQUIRE(legacy_parser::write(output_path, &original));

    OsuLegacyDatabase roundtrip;
    REQUIRE(legacy_parser::parse(output_path, &roundtrip));
    REQUIRE(roundtrip.version == original.version);
    REQUIRE(roundtrip.player_name == original.player_name);
    REQUIRE(roundtrip.beatmaps_count == original.beatmaps_count);
    REQUIRE(roundtrip.beatmaps.front().md5 == original.beatmaps.front().md5);
    REQUIRE(roundtrip.beatmaps.back().md5 == original.beatmaps.back().md5);
}

TEST_CASE("legacy parser read collection.db", "[parsers][legacy]") {
    OsuLegacyCollection database;
    const auto path = (test_helper::osu_root() / "collection.db").string();

    REQUIRE(legacy_collection_parser::parse(path, &database));
    REQUIRE(database.collections_count == static_cast<int>(database.collections.size()));
    REQUIRE(database.collections.size() >= 2);

    const auto glass_beach = std::find_if(database.collections.begin(), database.collections.end(),
                                          [](const auto& item) { return item.name == "glass beach"; });
    REQUIRE(glass_beach != database.collections.end());
    REQUIRE(glass_beach->beatmaps_count == 10);
    REQUIRE(glass_beach->beatmap_md5.front() == "6737a1d011bd8ea8b008aff294147f33");

    const auto monet = std::find_if(database.collections.begin(), database.collections.end(),
                                    [](const auto& item) { return item.name == "monet"; });
    REQUIRE(monet != database.collections.end());
    REQUIRE(monet->beatmaps_count == 1);
}

TEST_CASE("legacy collection parser roundtrip preserves collection data", "[parsers][legacy]") {
    OsuLegacyCollection original;
    const auto input_path = (test_helper::osu_root() / "collection.db").string();
    REQUIRE(legacy_collection_parser::parse(input_path, &original));

    const auto output_path = (test_helper::temp_root() / "legacy-roundtrip.collection.db").string();
    std::filesystem::remove(output_path);
    REQUIRE(legacy_collection_parser::write(output_path, &original));

    OsuLegacyCollection roundtrip;
    REQUIRE(legacy_collection_parser::parse(output_path, &roundtrip));
    REQUIRE(roundtrip.version == original.version);
    REQUIRE(roundtrip.collections_count == original.collections_count);
    REQUIRE(roundtrip.collections[0].name == original.collections[0].name);
    REQUIRE(roundtrip.collections[0].beatmap_md5 == original.collections[0].beatmap_md5);
}
