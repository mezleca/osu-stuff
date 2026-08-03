#include "../src/api/osu-v2/detail.hpp"

#include <catch2/catch_test_macros.hpp>
#include <cstdlib>
#include <string>

static OAuthAuthRequest get_live_auth_data() {
    const char* id = std::getenv("OSU_ID");
    const char* secret = std::getenv("OSU_SECRET");

    if (id == nullptr || secret == nullptr) {
        return {};
    }

    return OAuthAuthRequest{
        .client_id = id,
        .client_secret = secret,
        .grant_type = "client_credentials",
        .scope = std::set<std::string>{"public"},
        .code = std::nullopt,
        .state = std::nullopt,
        .redirect_uri = std::nullopt,
        .refresh_token = "",
    };
}

TEST_CASE("oauth base implementation authenticates against osu", "[oauth][live]") {
    const auto auth_data = get_live_auth_data();

    if (auth_data.client_id.empty() || auth_data.client_secret.empty()) {
        SKIP("OSU_ID and OSU_SECRET are required for the live osu! API test");
    }

    OAuthApi api("https://osu.ppy.sh", OAuthAuthType::CLIENT_CREDENTIALS_GRANT);
    api.set_auth_data(auth_data);
    api.authenticate();

    REQUIRE(api.has_valid_access_token());
    REQUIRE_FALSE(api.get_access_token().empty());
}

TEST_CASE("osu api authenticates and parses a real beatmap", "[osu-api][live]") {
    const auto auth_data = get_live_auth_data();

    if (auth_data.client_id.empty() || auth_data.client_secret.empty()) {
        SKIP("OSU_ID and OSU_SECRET are required for the live osu! API test");
    }

    OsuV2API api;
    api.set_auth_data(auth_data);

    const auto beatmap = api.get_beatmap({.beatmap = 75});

    REQUIRE(beatmap.has_value());
    REQUIRE(beatmap->id == 75);
    REQUIRE_FALSE(beatmap->mode.empty());
    REQUIRE_FALSE(beatmap->version.empty());
}

TEST_CASE("osu api endpoints return parseable responses", "[osu-api][live]") {
    const auto auth_data = get_live_auth_data();

    if (auth_data.client_id.empty() || auth_data.client_secret.empty()) {
        SKIP("OSU_ID and OSU_SECRET are required for the live osu! API test");
    }

    OsuV2API api;
    api.set_auth_data(auth_data);

    const auto beatmap = api.get_beatmap({.beatmap = 75});
    REQUIRE(beatmap.has_value());
    REQUIRE(beatmap->beatmapset_id > 0);

    REQUIRE(api.get_beatmaps({.ids = {75}}).has_value());
    REQUIRE(api.get_beatmap_packs({.type = "standard"}).has_value());
    REQUIRE(api.get_beatmap_pack({.pack = "S1"}).has_value());
    REQUIRE(api.lookup_beatmap({.id = "75"}).has_value());
    REQUIRE(api.get_user_beatmap_score({.beatmap = 75, .user = 2}).has_value());
    REQUIRE(api.get_user_beatmap_scores({.beatmap = 75, .user = 2}).has_value());
    REQUIRE(api.get_beatmap_scores({.beatmap = 75}).has_value());
    REQUIRE(api.get_beatmap_attributes({.beatmap = 75}).has_value());
    REQUIRE(api.get_beatmapset_discussions({.beatmap_id = "75", .limit = 1}).has_value());
    REQUIRE(api.get_beatmapset_discussion_posts({.limit = 1}).has_value());
    REQUIRE(api.get_beatmapset_discussion_votes({.limit = 1}).has_value());
    REQUIRE(api.search_beatmapsets({.query = "circles"}).has_value());
    REQUIRE(api.lookup_beatmapset({.beatmap_id = 75}).has_value());
    REQUIRE(api.get_beatmapset({.beatmapset = std::to_string(beatmap->beatmapset_id)}).has_value());
    REQUIRE(api.get_events({}).has_value());

    const auto forums = api.get_forum_listing({});
    REQUIRE(forums.has_value());

    const auto topics = api.get_topic_listing({.limit = 1});
    REQUIRE(topics.has_value());

    if (!topics->topics.empty()) {
        REQUIRE(api.get_topic_and_posts({.topic = topics->topics.front().id, .limit = 1}).has_value());
    }

    if (!forums->forums.empty()) {
        REQUIRE(api.get_forum_and_topics({.forum = forums->forums.front().id}).has_value());
    }

    REQUIRE(api.search({.mode = "user", .query = "peppy"}).has_value());

    const auto matches = api.get_matches_listing({.limit = 1});
    REQUIRE(matches.has_value());
    if (!matches->matches.empty()) {
        REQUIRE(api.get_match({.match = static_cast<int32_t>(matches->matches.front().id), .limit = 1}).has_value());
    }
}
