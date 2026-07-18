#include "parser/beatmap/beatmap.hpp"
#include "helper.hpp"

#include <catch2/catch_test_macros.hpp>

TEST_CASE("beatmap parser read", "[parsers][beatmap]") {
    ParsedBeatmap beatmap;
    beatmap_parser::data = &beatmap;

    const auto path = (test_helper::osu_root() / "Songs/2134701 The Killers - Mr Brightside" /
                       "The Killers - Mr. Brightside (mindmaster107) [HD1].osu")
                          .string();

    REQUIRE(beatmap_parser::parse(path));
    REQUIRE(beatmap.version == 14);
    REQUIRE(beatmap.metadata.title == "Mr. Brightside");
    REQUIRE(beatmap.metadata.artist == "The Killers");
    REQUIRE(beatmap.metadata.version == "HD1");
    REQUIRE(beatmap.metadata.beatmap_set_id == 2134701);
    REQUIRE(beatmap.difficulty.approach_rate == 8.0);
    REQUIRE(beatmap.background.has_value());
    REQUIRE(beatmap.background->filename == "64494768_p0.jpg");
    REQUIRE(beatmap.hit_objects.size() == 905);
}

TEST_CASE("beatmap parser preserves the important map fields", "[parsers][beatmap]") {
    ParsedBeatmap original;
    beatmap_parser::data = &original;

    const auto input_path = (test_helper::osu_root() / "Songs/2134701 The Killers - Mr Brightside" /
                             "The Killers - Mr. Brightside (mindmaster107) [HD1].osu")
                                .string();

    REQUIRE(beatmap_parser::parse(input_path));

    beatmap_parser::location = (test_helper::temp_root() / "beatmap-roundtrip.osu").string();
    std::filesystem::remove(beatmap_parser::location);
    REQUIRE(beatmap_parser::write());

    ParsedBeatmap roundtrip;
    beatmap_parser::data = &roundtrip;
    REQUIRE(beatmap_parser::parse(beatmap_parser::location));
    REQUIRE(roundtrip.metadata.title == original.metadata.title);
    REQUIRE(roundtrip.metadata.artist == original.metadata.artist);
    REQUIRE(roundtrip.metadata.version == original.metadata.version);
    REQUIRE(roundtrip.hit_objects.size() == original.hit_objects.size());
    REQUIRE(roundtrip.timing_points.size() == original.timing_points.size());
}
