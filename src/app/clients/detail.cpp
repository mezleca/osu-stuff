#include "detail.hpp"
#include "../schemas/lazer.hpp"

std::string client_detail::detach_or_empty(const realm::managed<std::optional<std::string>>& value) {
    return value.detach().value_or("");
}

BeatmapGamemode client_detail::detach_mode(const realm::managed<realm::Ruleset*>& ruleset) {
    if (!ruleset) return BeatmapGamemode::OSU;

    const auto short_name = ruleset->ShortName.detach().value.value_or("");

    if (short_name == "taiko") return BeatmapGamemode::TAIKO;
    if (short_name == "fruits") return BeatmapGamemode::CATCH;
    if (short_name == "mania") return BeatmapGamemode::MANIA;

    return BeatmapGamemode::OSU;
}

int64_t client_detail::detach_time_ms(const realm_time_ns& value) {
    const auto detached = value.detach();

    if (!detached.has_value()) {
        return 0;
    }

    return std::chrono::duration_cast<std::chrono::milliseconds>(detached->time_since_epoch()).count();
}
