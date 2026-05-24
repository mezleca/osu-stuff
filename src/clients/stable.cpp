#include "stable.hpp"
#include "../parser/legacy/legacy_collection.hpp"

#include <utility>

StableClient::StableClient(ClientOptions options) : m_options(std::move(options)) {
    if (m_options.osu_path.empty()) {
        std::cout << "warn: empty osu path" << "\n";
        return;
    }

    const std::filesystem::path osu_path(m_options.osu_path);

    load_beatmaps(osu_path / "osu!.db");
    load_collections(osu_path / "collection.db");
    rebuild_beatmapsets_from_beatmaps();
}

const char* StableClient::player_name() const {
    return m_player_name.c_str();
}

std::vector<std::string> StableClient::fetch_missing_beatmaps_from_collections(std::string_view collection_name) {
    std::vector<std::string> missing;

    auto append_missing = [this, &missing](const OsuCollection& collection) {
        for (const auto& hash : collection.hashes) {
            if (m_beatmaps.find(hash) == m_beatmaps.end()) {
                missing.push_back(hash);
            }
        }
    };

    if (!collection_name.empty()) {
        const auto* collection = get_collection(collection_name);

        if (collection == nullptr) {
            return {};
        }

        append_missing(*collection);
        return missing;
    }

    for (const auto& [_, collection] : m_collections) {
        append_missing(*collection);
    }

    return missing;
}

bool StableClient::update_collection() {
    if (m_options.osu_path.empty()) {
        return false;
    }

    OsuLegacyCollection database;

    database.version = 20240820;
    database.collections.reserve(m_collections.size());

    for (const auto& [_, collection] : m_collections) {
        LegacyCollection legacy_collection;

        legacy_collection.name = collection->name;
        legacy_collection.beatmap_md5 = collection->hashes;
        legacy_collection.beatmaps_count = static_cast<int>(legacy_collection.beatmap_md5.size());

        database.collections.push_back(std::move(legacy_collection));
    }

    const std::filesystem::path output_path = std::filesystem::path(m_options.osu_path) / "collection.db";
    return legacy_collection_parser::write(output_path.string(), &database);
}

void StableClient::load_beatmaps(const std::filesystem::path& database_path) {
    OsuLegacyDatabase database;
    std::filesystem::path mutable_path = database_path;

    if (!legacy_parser::parse(mutable_path, &database)) {
        return;
    }

    m_player_name = database.player_name;

    for (const auto& legacy_beatmap : database.beatmaps) {
        auto beatmap = std::make_unique<OsuBeatmap>(legacy_beatmap);
        beatmap->build_search();
        m_beatmaps.emplace(beatmap->md5, std::move(beatmap));
    }
}

void StableClient::load_collections(const std::filesystem::path& database_path) {
    OsuLegacyCollection database;

    if (!legacy_collection_parser::parse(database_path.string(), &database)) {
        return;
    }

    for (const auto& legacy_collection : database.collections) {
        auto collection = std::make_unique<OsuCollection>();
        collection->name = legacy_collection.name;
        collection->hashes = legacy_collection.beatmap_md5;
        m_collections.emplace(collection->name, std::move(collection));
    }
}
