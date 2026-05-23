#include "lazer.hpp"
#include "../schemas/lazer.hpp"

#include <cpprealm/db.hpp>
#include <exception>
#include <utility>

std::unique_ptr<OsuCollection> make_collection(const realm::BeatmapCollection& collection) {
    auto result = std::make_unique<OsuCollection>();

    result->name = collection.Name.value_or("");
    result->hashes.reserve(collection.BeatmapMD5Hashes.size());

    for (auto& hash : collection.BeatmapMD5Hashes) {
        if (hash) {
            result->hashes.push_back(std::move(*hash));
        }
    }

    return result;
}

std::unique_ptr<OsuBeatmap> make_beatmap(const realm::managed<realm::Beatmap>& source) {
    auto result = std::make_unique<OsuBeatmap>(source);
    result->build_search();
    return result;
}

LazerClient::LazerClient(ClientOptions options) : m_options(std::move(options)) {
    if (m_options.lazer_realm_path.empty()) {
        return;
    }

    realm::db_config config;
    config.set_path(m_options.lazer_realm_path);
    config.set_schema_mode(realm::db_config::schema_mode::read_only);

    m_realm = std::make_unique<realm::db>(
        realm::open<realm::BeatmapDifficulty, realm::BeatmapUserSettings, realm::RealmUser, realm::Ruleset, realm::File,
                    realm::RealmNamedFileUsage, realm::BeatmapMetadata, realm::BeatmapCollection, realm::BeatmapSet,
                    realm::Beatmap>(config));

    if (!m_realm) {
        return;
    }

    try {
        auto beatmaps = m_realm->objects<realm::Beatmap>();

        for (auto beatmap : beatmaps) {
            std::optional<std::string> md5 = beatmap.MD5Hash.detach();

            if (!md5 || md5->empty()) {
                continue;
            }

            auto stored = make_beatmap(beatmap);
            m_beatmaps.emplace(*md5, std::move(stored));
        }

        auto collections = m_realm->objects<realm::BeatmapCollection>();

        for (auto collection : collections) {
            auto stored = make_collection(collection.detach());
            m_collections.emplace(stored->name, std::move(stored));
        }

        rebuild_beatmapsets_from_beatmaps();
    } catch (const std::exception&) {
        m_beatmaps.clear();
        m_collections.clear();
        m_beatmapsets.clear();
    }
}

LazerClient::~LazerClient() = default;

const char* LazerClient::player_name() const {
    return m_player_name.c_str();
}

std::vector<std::string> LazerClient::get_missing_beatmaps(std::string_view collection_name) {
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

bool LazerClient::update_collection() {
    return false;
}
