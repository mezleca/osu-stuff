#pragma once

#include <string>
#include <cpprealm/sdk.hpp>

enum class BeatmapStatus : int {
    UKNOWN = 0,
    UNSUBMITTED,
    GRAVEYARD,
    WIP,
    PENDING,
    UNUSED,
    RANKED,
    APPROVED,
    QUALIFIED,
    LOVED
};

enum class BeatmapGamemode : int { OSU = 0, TAIKO, CATCH, MANIA };

namespace realm {
    struct Ruleset;
}

namespace client_detail {
    using realm_time_ns = realm::managed<std::optional<std::chrono::time_point<std::chrono::system_clock>>>;

    std::string detach_or_empty(const realm::managed<std::optional<std::string>>& value);
    BeatmapGamemode detach_mode(const realm::managed<realm::Ruleset*>& ruleset);
    int64_t detach_time_ms(const realm_time_ns& value);
} // namespace client_detail
