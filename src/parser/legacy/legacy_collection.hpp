#pragma once

#include <string>
#include <vector>

struct LegacyCollection {
    std::string name;
    int beatmaps_count = 0;
    std::vector<std::string> beatmap_md5;
};

struct OsuLegacyCollection {
    int version = 0;
    int collections_count = 0;
    std::vector<LegacyCollection> collections;
};

namespace legacy_collection_parser {
bool parse(const std::string location, OsuLegacyCollection* data);
bool write(const std::string location, OsuLegacyCollection* data);
}; // namespace legacy_collection_parser
