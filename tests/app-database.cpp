#include "app/database/database.hpp"
#include "utils/helper.hpp"

#include <catch2/catch_test_macros.hpp>
#include <filesystem>
#include <stdexcept>
#include <string>

TEST_CASE("app database initializes defaults and persists updates", "[database]") {
    const std::filesystem::path root = test_helper::temp_root() / "app-database";
    const std::filesystem::path path = root / "app.realm";
    std::filesystem::remove_all(root);

    {
        app::AppDatabase database(path);
        REQUIRE_FALSE(database.initialized());
        REQUIRE_THROWS_AS(database.get(), std::logic_error);

        database.initialize();
        database.initialize();
        REQUIRE(database.initialized());

        auto config = database.get();
        REQUIRE(config.credentials);
        REQUIRE(config.osu_data);
        REQUIRE(config.radio);
        REQUIRE(config.radio->volume.detach() == 50);
        REQUIRE_FALSE(config.radio->shuffle.detach());
        REQUIRE_FALSE(config.radio->repeat.detach());

        database.update([](auto& value) {
            value.credentials->id = "client-id";
            value.credentials->secret = "client-secret";
            value.osu_data->location = "/tmp/osu";
            value.osu_data->lazer = true;
            value.radio->volume = 72;
            value.radio->shuffle = true;
        });
    }

    {
        app::AppDatabase database(path);
        database.initialize();

        auto config = database.get();
        REQUIRE(config.credentials->id.detach() == "client-id");
        REQUIRE(config.credentials->secret.detach() == "client-secret");
        REQUIRE(config.osu_data->location.detach() == "/tmp/osu");
        REQUIRE(config.osu_data->lazer.detach());
        REQUIRE(config.radio->volume.detach() == 72);
        REQUIRE(config.radio->shuffle.detach());
    }
}
