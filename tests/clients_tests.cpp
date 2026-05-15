#include <algorithm>
#include <memory>
#include <string>
#include <string_view>

#include <catch2/catch_test_macros.hpp>

#include "../src/clients/lazer.hpp"
#include "../src/clients/stable.hpp"
#include "../src/parser/legacy/legacy_collection.hpp"
#include "test_helper.hpp"

constexpr int STABLE_BEATMAP_COUNT = 47;
constexpr int LAZER_BEATMAP_COUNT = 48;
constexpr int TEST_BEATMAPSET_ID = 1326501;
constexpr int TEST_BEATMAP_ID = 2953473;
constexpr int GLASS_BEACH_RESULT_COUNT = 18;
constexpr const char* TEST_BEATMAP_HASH = "8e66c5e88adb59774e4eccca702fe242";

std::unique_ptr<ClientBase> make_client(std::string_view backend, const std::string& root_override = "") {
    if (backend == "stable") {
        const auto root = root_override.empty() ? test_helper::osu_root().string() : root_override;
        return std::make_unique<StableClient>(ClientOptions{.osu_path = root});
    }

    return std::make_unique<LazerClient>(ClientOptions{
        .lazer_realm_path = (test_helper::lazer_root() / "client.realm").string(),
        .lazer_files_path = (test_helper::lazer_root() / "files").string(),
    });
}

void check_client_state(ClientBase& client, int expected_beatmap_count) {
    const auto collections = client.get_collections();
    REQUIRE_FALSE(collections.empty());
    REQUIRE(client.get_collection("glass beach") != nullptr);

    const auto beatmaps = client.search_beatmaps(SearchOptions{.query = ""});
    REQUIRE(static_cast<int>(beatmaps.size()) == expected_beatmap_count);

    const auto* beatmap = client.get_beatmap_by_id(TEST_BEATMAP_ID);
    REQUIRE(beatmap != nullptr);
    REQUIRE(beatmap->difficulty == "height of the summer");

    const auto* beatmapset = client.get_beatmapset(TEST_BEATMAPSET_ID);
    REQUIRE(beatmapset != nullptr);
    REQUIRE(beatmapset->title == "dallas");

    const auto glass_beach = client.search_beatmaps(SearchOptions{.query = "artist=\"glass beach\""});
    REQUIRE(static_cast<int>(glass_beach.size()) == GLASS_BEACH_RESULT_COUNT);

    const auto filtered = client.search_beatmaps(SearchOptions{.query = "artist=\"glass beach\" ar>=8"});
    REQUIRE_FALSE(filtered.empty());

    const auto sorted_by_duration = client.search_beatmaps(SearchOptions{.query = "", .sort = "duration"});
    REQUIRE_FALSE(sorted_by_duration.empty());

    double last_duration = client.get_beatmap(sorted_by_duration.front())->duration.value_or(0.0);

    for (const auto& hash : sorted_by_duration) {
        const auto* current = client.get_beatmap(hash);
        REQUIRE(current != nullptr);

        const double current_duration = current->duration.value_or(0.0);
        REQUIRE(last_duration >= current_duration);
        last_duration = current_duration;
    }

    const auto with_duration = client.search_beatmaps(SearchOptions{.query = "", .has_duration = true});
    REQUIRE(with_duration.size() <= beatmaps.size());

    for (const auto& hash : with_duration) {
        const auto* current = client.get_beatmap(hash);
        REQUIRE(current != nullptr);
        REQUIRE(current->duration.has_value());
        REQUIRE(current->duration.value() >= 0.0);
    }
}

void check_temp_collection(ClientBase& client, bool expect_update_success, std::string_view name) {
    OsuCollection collection{.name = std::string(name), .hashes = {TEST_BEATMAP_HASH}};

    REQUIRE(client.add_collection(&collection));

    const auto* stored = client.get_collection(name);
    REQUIRE(stored != nullptr);
    REQUIRE(stored->hashes == std::vector<std::string>{TEST_BEATMAP_HASH});

    REQUIRE(client.update_collection() == expect_update_success);
    REQUIRE(client.delete_collection(name));
    REQUIRE(client.get_collection(name) == nullptr);
}

TEST_CASE("clients initialization", "[clients]") {
    SECTION("stable") {
        auto client = make_client("stable");
        check_client_state(*client, STABLE_BEATMAP_COUNT);
        check_temp_collection(*client, true, "temp-stable");
    }

    SECTION("lazer") {
        auto client = make_client("lazer");
        check_client_state(*client, LAZER_BEATMAP_COUNT);
        check_temp_collection(*client, false, "temp-lazer");
    }
}

TEST_CASE("stable update_collection persists the in memory collections", "[clients]") {
    test_helper::TempDir temp_dir("osu-stuff-stable-client");
    const auto copied_root = temp_dir.path() / "osu";
    std::filesystem::copy(test_helper::osu_root(), copied_root, std::filesystem::copy_options::recursive);

    auto client = make_client("stable", copied_root.string());
    OsuCollection collection{.name = "persisted collection", .hashes = {TEST_BEATMAP_HASH}};

    REQUIRE(client->add_collection(&collection));
    REQUIRE(client->update_collection());

    OsuLegacyCollection database;
    REQUIRE(legacy_collection_parser::parse((copied_root / "collection.db").string(), &database));

    const auto it = std::find_if(database.collections.begin(), database.collections.end(),
                                 [](const auto& item) { return item.name == "persisted collection"; });

    REQUIRE(it != database.collections.end());
    REQUIRE(it->beatmap_md5 == std::vector<std::string>{TEST_BEATMAP_HASH});
}
