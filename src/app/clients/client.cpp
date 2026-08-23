#include "client.hpp"

#include <algorithm>

constexpr std::string_view SORT_ARTIST = "artist";
constexpr std::string_view SORT_CREATOR = "creator";
constexpr std::string_view SORT_DIFFICULTY = "difficulty";
constexpr std::string_view SORT_DURATION = "duration";

[[nodiscard]] static auto normalized_sort_value(std::string_view value) -> std::string {
    return binary::normalize_and_lower(value);
}

[[nodiscard]] static auto compare_beatmaps(OsuBeatmap* left, OsuBeatmap* right, std::string_view sort_key) -> bool {
    if (sort_key == SORT_DURATION) {
        const double left_duration = left->duration.value_or(0.0);
        const double right_duration = right->duration.value_or(0.0);

        if (left_duration != right_duration) {
            return left_duration > right_duration;
        }
    } else if (sort_key == SORT_ARTIST) {
        const auto left_artist = normalized_sort_value(left->artist);
        const auto right_artist = normalized_sort_value(right->artist);

        if (left_artist != right_artist) {
            return left_artist < right_artist;
        }
    } else if (sort_key == SORT_CREATOR) {
        const auto left_creator = normalized_sort_value(left->creator);
        const auto right_creator = normalized_sort_value(right->creator);

        if (left_creator != right_creator) {
            return left_creator < right_creator;
        }
    } else if (sort_key == SORT_DIFFICULTY) {
        const auto left_difficulty = normalized_sort_value(left->difficulty);
        const auto right_difficulty = normalized_sort_value(right->difficulty);

        if (left_difficulty != right_difficulty) {
            return left_difficulty < right_difficulty;
        }
    } else {
        const auto left_title = normalized_sort_value(left->title);
        const auto right_title = normalized_sort_value(right->title);

        if (left_title != right_title) {
            return left_title < right_title;
        }
    }

    if (left->beatmap_id != right->beatmap_id) {
        return left->beatmap_id < right->beatmap_id;
    }

    return left->difficulty_id < right->difficulty_id;
}

[[nodiscard]] static auto matches_search_options(const OsuBeatmap& beatmap, const SearchOptions& options) -> bool {
    if (options.has_duration && (!beatmap.duration.has_value() || beatmap.duration.value() < 0.0)) {
        return false;
    }

    if (options.difficulty_min > 0.0 && beatmap.overall_difficulty < options.difficulty_min) {
        return false;
    }

    if (options.difficulty_max > 0.0 && beatmap.overall_difficulty > options.difficulty_max) {
        return false;
    }

    return true;
}

OsuCollection* ClientBase::get_collection(std::string_view name) {
    const auto it = m_collections.find(std::string(name));

    if (it == m_collections.end()) {
        return nullptr;
    }

    return it->second.get();
}

bool ClientBase::add_collection(OsuCollection* collection) {
    if (collection == nullptr || collection->name.empty()) {
        return false;
    }

    const auto [_, inserted] = m_collections.emplace(collection->name, std::make_unique<OsuCollection>(*collection));
    return inserted;
}

bool ClientBase::delete_collection(std::string_view name) {
    return m_collections.erase(std::string(name)) > 0;
}

bool ClientBase::update_collection() {
    return false;
}

OsuBeatmap* ClientBase::get_beatmap(std::string md5) {
    const auto it = m_beatmaps.find(std::move(md5));

    if (it == m_beatmaps.end()) {
        return nullptr;
    }

    return it->second.get();
}

OsuBeatmap* ClientBase::get_beatmap_by_id(int id) {
    for (auto& [_, beatmap] : m_beatmaps) {
        if (beatmap->difficulty_id == id) {
            return beatmap.get();
        }
    }

    return nullptr;
}

OsuBeatmapSet* ClientBase::get_beatmapset(int id) {
    const auto it = m_beatmapsets.find(id);

    if (it == m_beatmapsets.end()) {
        return nullptr;
    }

    return it->second.get();
}

std::vector<OsuCollection*> ClientBase::get_collections() {
    std::vector<OsuCollection*> collections;
    collections.reserve(m_collections.size());

    for (auto& [_, collection] : m_collections) {
        collections.push_back(collection.get());
    }

    return collections;
}

std::vector<std::string> ClientBase::search_beatmaps(const SearchOptions& options) {
    std::vector<std::string> hashes;
    std::vector<OsuBeatmap*> beatmaps = filter_beatmaps(options);

    std::sort(beatmaps.begin(), beatmaps.end(), [&options](OsuBeatmap* left, OsuBeatmap* right) {
        return compare_beatmaps(left, right, options.sort);
    });

    hashes.reserve(beatmaps.size());

    for (const auto* beatmap : beatmaps) {
        hashes.push_back(beatmap->md5);
    }

    return hashes;
}

std::vector<OsuBeatmap*> ClientBase::filter_beatmaps(const SearchOptions& data) {
    std::vector<OsuBeatmap*> result;
    const std::string normalized_query = binary::lower_if_possible(data.query);

    m_criteria.parse_query(normalized_query);

    for (auto& [_, beatmap] : m_beatmaps) {
        if (!matches_filter(*beatmap)) {
            continue;
        }

        if (!matches_search_options(*beatmap, data)) {
            continue;
        }

        result.push_back(beatmap.get());
    }

    return result;
}

bool ClientBase::matches_filter(const OsuBeatmap& beatmap) const {
    if (m_criteria.artist.has_filter() &&
        !m_criteria.matches_text_any({beatmap.artist, beatmap.artist_unicode}, m_criteria.artist)) {
        return false;
    }

    if (m_criteria.title.has_filter() &&
        !m_criteria.matches_text_any({beatmap.title, beatmap.title_unicode}, m_criteria.title)) {
        return false;
    }

    if (!m_criteria.matches_text(beatmap.creator, m_criteria.creator)) {
        return false;
    }

    if (!m_criteria.matches_text(beatmap.difficulty, m_criteria.difficulty)) {
        return false;
    }

    if (!m_criteria.matches_text(beatmap.source, m_criteria.source)) {
        return false;
    }

    if (m_criteria.approach_rate.has_filter() && !m_criteria.approach_rate.matches(beatmap.approach_rate)) {
        return false;
    }

    if (m_criteria.circle_size.has_filter() && !m_criteria.circle_size.matches(beatmap.circle_size)) {
        return false;
    }

    if (m_criteria.overall_difficulty.has_filter() &&
        !m_criteria.overall_difficulty.matches(beatmap.overall_difficulty)) {
        return false;
    }

    if (m_criteria.hp_drain.has_filter() && !m_criteria.hp_drain.matches(beatmap.hp_drain)) {
        return false;
    }

    if (m_criteria.status.has_filter() && !m_criteria.status.matches(static_cast<int>(beatmap.status))) {
        return false;
    }

    if (!m_criteria.query.empty() && beatmap.searchable.find(m_criteria.query) == std::string::npos) {
        return false;
    }

    return true;
}

void ClientBase::rebuild_beatmapsets_from_beatmaps() {
    m_beatmapsets.clear();

    for (auto& [_, beatmap] : m_beatmaps) {
        if (beatmap->beatmap_id <= 0) {
            continue;
        }

        auto& beatmapset = m_beatmapsets[beatmap->beatmap_id];

        if (!beatmapset) {
            beatmapset = std::make_unique<OsuBeatmapSet>(OsuBeatmapSet{
                .artist = beatmap->artist,
                .artist_unicode = beatmap->artist_unicode,
                .title = beatmap->title,
                .title_unicode = beatmap->title_unicode,
                .creator = beatmap->creator,
                .beatmapset_id = beatmap->beatmap_id,
                .beatmaps = {},
            });
        }

        beatmapset->beatmaps.push_back(beatmap.get());
    }
}
