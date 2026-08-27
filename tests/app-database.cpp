#include "database/database.hpp"
#include "utils/helper.hpp"

#include <catch2/catch_test_macros.hpp>
#include <filesystem>
#include <stdexcept>

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
        REQUIRE(config.radio_background.detach());
        REQUIRE_FALSE(config.radio_repeat.detach());
        REQUIRE_FALSE(config.radio_random.detach());

        const auto initial_last_update = database.last_update();
        REQUIRE(config.last_updated.detach() == initial_last_update);

        database.update([](auto&, auto&) {});
        REQUIRE(database.last_update() == initial_last_update);

        database.update([](auto& change, auto& value) {
            change.set(value.credentials->id, "client-id");
            change.set(value.credentials->secret, "client-secret");
            change.set(value.osu_data->stable_path, "/tmp/osu/stable");
            change.set(value.osu_data->lazer_path, "/tmp/osu/lazer");
            change.set(value.osu_data->type, 1);
            change.set(value.radio->volume, 72);
            change.set(value.radio->shuffle, true);
            change.set(value.radio_background, false);
            change.set(value.radio_repeat, true);
            change.set(value.radio_random, true);
        });

        const auto updated_last_update = database.last_update();
        REQUIRE(updated_last_update > initial_last_update);
        REQUIRE(database.get().last_updated.detach() == updated_last_update);

        auto volume = DATABASE_FIELD(&database, radio->volume);
        REQUIRE(volume.value() == 72);
        volume.value() = 84;
        volume.commit();

        const auto binding_last_update = database.last_update();
        REQUIRE(binding_last_update > updated_last_update);
        REQUIRE(database.get().radio->volume.detach() == 84);

        database.update([](auto& change, auto& value) {
            change.set(value.credentials->id, "client-id");
            change.set(value.radio->volume, 84);
        });
        REQUIRE(database.last_update() == binding_last_update);
    }

    {
        app::AppDatabase database(path);
        database.initialize();

        auto config = database.get();
        REQUIRE(config.credentials->id.detach() == "client-id");
        REQUIRE(config.credentials->secret.detach() == "client-secret");
        REQUIRE(config.osu_data->stable_path.detach() == "/tmp/osu/stable");
        REQUIRE(config.osu_data->lazer_path.detach() == "/tmp/osu/lazer");
        REQUIRE(config.osu_data->type.detach() == 1);
        REQUIRE(config.radio->volume.detach() == 84);
        REQUIRE(config.radio->shuffle.detach());
        REQUIRE_FALSE(config.radio_background.detach());
        REQUIRE(config.radio_repeat.detach());
        REQUIRE(config.radio_random.detach());
        REQUIRE(config.last_updated.detach() > std::chrono::time_point<std::chrono::system_clock>{});
    }
}
