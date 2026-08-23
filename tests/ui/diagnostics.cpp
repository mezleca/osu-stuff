#include <catch2/catch_test_macros.hpp>

#include "ui/diagnostics/profiler.hpp"

TEST_CASE("ui profiler exposes completed nested zones") {
    ui::Profiler profiler;
    profiler.set_enabled(true);
    profiler.begin_frame();

    {
        ui::ScopedProfileZone outer(&profiler, "outer", 10);
        ui::ScopedProfileZone inner(&profiler, "inner", 20);
    }

    profiler.end_frame();
    const std::span<const ui::ProfileEvent> events = profiler.latest_events();

    REQUIRE(events.size() == 2);
    REQUIRE(events[0].name == "outer");
    REQUIRE(events[0].depth == 0);
    REQUIRE(events[1].name == "inner");
    REQUIRE(events[1].depth == 1);
    REQUIRE(events[0].end >= events[0].start);
    REQUIRE(events[1].end >= events[1].start);
    REQUIRE(profiler.node_duration_ms(20) >= 0.0);
    REQUIRE(profiler.dropped_events() == 0);
    REQUIRE(profiler.has_report());

    profiler.clear_report();
    REQUIRE_FALSE(profiler.has_report());
}
