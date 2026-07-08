#include "../src/api/osu-v2/detail.hpp"

#include <catch2/catch_test_macros.hpp>
#include <cstdlib>

TEST_CASE("osu-api", "v2") {
    const char* id = std::getenv("OSU_ID");
    const char* secret = std::getenv("OSU_SECRET");

    if (id == nullptr || secret == nullptr) {
        FAIL("invalid id / secret");
    }

    SECTION("auth") {
        bool successfull =
            osu_v2::authenticate({.client_id = std::stoi(id), .client_secret = secret, .scope = {{"public"}}});

        if (!successfull) {
            FAIL("failed to authenticate");
        }
    }
}
