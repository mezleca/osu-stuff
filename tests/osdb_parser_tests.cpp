#include <catch2/catch_test_macros.hpp>

#include "../src/parser/osdb/osdb.hpp"
#include "test_helper.hpp"

#include <cmath>

TEST_CASE("osdb parser write / parse", "[parsers][osdb]") {
    test_helper::TempDir temp_dir("osu-stuff-osdb");
    const auto path = (temp_dir.path() / "collections.osdb").string();

    OsdbData original;
    original.version_string = "o!dm8";
    original.save_data = 123456789;
    original.last_editor = "codex";
    original.collections = {
        OsdbCollection{
            .name = "glass beach",
            .online_id = 77,
            .beatmaps =
                {
                    OsdbBeatmap{
                        .difficulty_id = 1,
                        .beatmapset_id = 10,
                        .artist = "glass beach",
                        .title = "running",
                        .difficulty = "setting sun",
                        .checksum = "abc",
                        .user_comment = "favorite",
                        .mode = 0,
                        .difficulty_rating = 5.35,
                    },
                },
            .hash_only_beatmaps = {"missing-md5"},
        },
        OsdbCollection{
            .name = "monet",
            .online_id = 99,
            .beatmaps =
                {
                    OsdbBeatmap{
                        .difficulty_id = 2,
                        .beatmapset_id = 20,
                        .artist = "monet",
                        .title = "FOOTPRINTS IN THE SAND",
                        .difficulty = "FOREVER",
                        .checksum = "def",
                        .user_comment = "",
                        .mode = 0,
                        .difficulty_rating = 6.12,
                    },
                },
            .hash_only_beatmaps = {},
        },
    };

    osdb_parser::data = &original;
    osdb_parser::location = path;
    REQUIRE(osdb_parser::write());

    OsdbData roundtrip;
    osdb_parser::data = &roundtrip;
    REQUIRE(osdb_parser::parse(path));
    REQUIRE(roundtrip.version_string == "o!dm8");
    REQUIRE(roundtrip.last_editor == "codex");
    REQUIRE(roundtrip.count == 2);
    REQUIRE(roundtrip.collections.size() == 2);
    REQUIRE(roundtrip.collections[0].name == "glass beach");
    REQUIRE(roundtrip.collections[0].online_id == 77);
    REQUIRE(roundtrip.collections[0].beatmaps[0].title == "running");
    REQUIRE(std::abs(roundtrip.collections[0].beatmaps[0].difficulty_rating - 5.35) < 0.000001);
    REQUIRE(roundtrip.collections[0].hash_only_beatmaps == std::vector<std::string>{"missing-md5"});
}
