#include "lazer.hpp"
#include "../schemas/lazer.hpp"

#include <cpprealm/db.hpp>

#include <exception>
#include <utility>

std::unique_ptr<OsuCollection>
make_collection(const realm::BeatmapCollection &collection) {
  std::vector<std::string> hashes;
  hashes.reserve(collection.BeatmapMD5Hashes.size());

  for (auto &hash : collection.BeatmapMD5Hashes) {
    if (hash)
      hashes.push_back(std::move(*hash));
  }

  return std::make_unique<OsuCollection>(collection.Name.value_or(""), hashes);
}

std::unique_ptr<OsuBeatmap> make_beatmap(const realm::Beatmap &beatmap) {
  return std::make_unique<OsuBeatmap>(beatmap);
}

std::unique_ptr<OsuBeatmapSet>
make_beatmapset(const realm::BeatmapSet &beatmap) {
  std::vector<OsuBeatmap *> beatmaps;

  auto &ref = beatmap.Beatmaps[0];
  if (!ref)
    return nullptr;

  return std::make_unique<OsuBeatmapSet>(
      ref->Metadata->Artist.value_or(""),
      ref->Metadata->ArtistUnicode.value_or(""),
      ref->Metadata->Title.value_or(""),
      ref->Metadata->TitleUnicode.value_or(""),
      ref->Metadata->Author->Username.value_or(""), ref->OnlineID, beatmaps);
}

LazerClient::LazerClient(ClientOptions options)
    : m_options(std::move(options)) {
  if (m_options.lazer_realm_path.empty()) {
    // set_error("lazer_realm_path is required", RESULT_INVALID_ARGUMENT);
    return;
  }

  realm::db_config config;
  config.set_path(m_options.lazer_realm_path);
  config.set_schema_mode(realm::db_config::schema_mode::read_only);

  m_realm = std::make_unique<realm::db>(
      realm::open<realm::BeatmapDifficulty, realm::BeatmapUserSettings,
                  realm::RealmUser, realm::Ruleset, realm::File,
                  realm::RealmNamedFileUsage, realm::BeatmapMetadata,
                  realm::BeatmapCollection, realm::BeatmapSet, realm::Beatmap>(
          config));

  if (!m_realm) {
    return;
  }

  try {
    auto beatmaps = m_realm->objects<realm::Beatmap>();

    for (auto beatmap : beatmaps) {
      std::optional<std::string> md5 = beatmap.MD5Hash.detach();

      if (md5 && !md5->empty()) {
        auto b = make_beatmap(beatmap.detach());
        m_beatmaps.emplace(std::string(*md5), std::move(b));
      }
    }

    auto collections = m_realm->objects<realm::BeatmapCollection>();

    for (auto collection : collections) {
      auto c = make_collection(collection.detach());
      m_collections.emplace(std::string(c->name), std::move(c));
    }
  } catch (const std::exception &error) {
    // set_error(error.what(), RESULT_INTERNAL_ERROR);
  }
}

LazerClient::~LazerClient() = default;

const char *LazerClient::player_name() const { return m_player_name.c_str(); }

std::vector<std::string> LazerClient::search_beatmaps(const SearchOptions &) {
  return {};
}

std::vector<std::string>
LazerClient::get_missing_beatmaps(std::string_view collection_name) {
  std::vector<std::string> missing;

  if (!collection_name.empty()) {
    const auto collection = m_collections.find(std::string(collection_name));

    if (collection == m_collections.end()) {
      return {};
    }

    for (const std::string &hash : collection->second->hashes) {
      if (m_beatmaps.find(hash) != m_beatmaps.end()) {
        missing.push_back(hash);
      }
    }

    return missing;
  }

  for (const auto &[_, collection] : m_collections) {
    for (auto &hash : collection->hashes) {
      if (m_beatmaps.find(hash) != m_beatmaps.end()) {
        missing.push_back(hash);
      }
    }
  }

  return missing;
}
