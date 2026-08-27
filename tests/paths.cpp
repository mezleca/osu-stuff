#include "utils/paths.hpp"

#include <catch2/catch_test_macros.hpp>
#include <cstdlib>
#include <filesystem>

TEST_CASE("app data path follows the platform convention", "[utils][paths]") {
    const auto app_data = paths::app_data();

#ifdef _WIN32
    const char* environment_name = "APPDATA";
#else
    const char* environment_name = "HOME";
#endif

    const char* environment_value = std::getenv(environment_name);
    if (environment_value == nullptr || *environment_value == '\0') {
        REQUIRE(app_data.empty());
        return;
    }

#ifdef _WIN32
    REQUIRE(app_data == environment_value);
#else
    REQUIRE(app_data == std::filesystem::path(environment_value) / ".local" / "share");
#endif
}
