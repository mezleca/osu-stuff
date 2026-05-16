#include "client.hpp"
#include "../utils/binary.hpp"

#include <algorithm>

namespace {
    constexpr std::string_view SORT_ARTIST = "artist";
    constexpr std::string_view SORT_CREATOR = "creator";
    constexpr std::string_view SORT_DIFFICULTY = "difficulty";
    constexpr std::string_view SORT_DURATION = "duration";

    std::string normalized_sort_value(std::string_view value) {
        return binary::normalize_and_lower(value);
    }

    bool compare_beatmaps(OsuBeatmap* left, OsuBeatmap* right, std::string_view sort_key) {
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
} // namespace

void ClientBase::fill_criteria_table() {
#define X(type, name, ...)                                                                                             \
    for (auto var : {#name __VA_OPT__(, ) __VA_ARGS__}) {                                                              \
        criteria_table[var][QueryOp::EQ] = [](const OsuBeatmap& s, std::string_view v) {                               \
            return binary::lower_if_possible(s.name) == binary::convert_to<type>(v);                                   \
        };                                                                                                             \
        criteria_table[var][QueryOp::NEQ] = [](const OsuBeatmap& s, std::string_view v) {                              \
            return binary::lower_if_possible(s.name) != binary::convert_to<type>(v);                                   \
        };                                                                                                             \
        criteria_table[var][QueryOp::GTE] = [](const OsuBeatmap& s, std::string_view v) {                              \
            return binary::lower_if_possible(s.name) >= binary::convert_to<type>(v);                                   \
        };                                                                                                             \
        criteria_table[var][QueryOp::GT] = [](const OsuBeatmap& s, std::string_view v) {                               \
            return binary::lower_if_possible(s.name) > binary::convert_to<type>(v);                                    \
        };                                                                                                             \
        criteria_table[var][QueryOp::LTE] = [](const OsuBeatmap& s, std::string_view v) {                              \
            return binary::lower_if_possible(s.name) <= binary::convert_to<type>(v);                                   \
        };                                                                                                             \
        criteria_table[var][QueryOp::LT] = [](const OsuBeatmap& s, std::string_view v) {                               \
            return binary::lower_if_possible(s.name) < binary::convert_to<type>(v);                                    \
        };                                                                                                             \
    }
    CRITERIA_FIELDS
#undef X
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

    std::sort(beatmaps.begin(), beatmaps.end(),
              [&options](OsuBeatmap* left, OsuBeatmap* right) { return compare_beatmaps(left, right, options.sort); });

    hashes.reserve(beatmaps.size());

    for (const auto* beatmap : beatmaps) {
        hashes.push_back(beatmap->md5);
    }

    return hashes;
}

std::vector<OsuBeatmap*> ClientBase::filter_beatmaps(const SearchOptions& data) {
    std::vector<OsuBeatmap*> result;

    std::string normalized_query_storage = binary::lower_if_possible(data.query);
    std::string_view normalized_query(normalized_query_storage);

    ParsedQuery p_query = query::parse(normalized_query);

    for (auto& it : m_beatmaps) {
        OsuBeatmap* beatmap = it.second.get();
        bool match_token = true;
        bool has_token_filter = false;

        for (const auto& token : p_query.tokens) {
            auto t_it = criteria_table.find(token.key);
            if (t_it == criteria_table.end()) {
                continue;
            }

            has_token_filter = true;

            if (!t_it->second[token.op](*beatmap, token.value)) {
                match_token = false;
                break;
            }
        }

        if (has_token_filter && !match_token) {
            continue;
        }

        if (!match_token) {
            continue;
        }

        if (beatmap->searchable.find(p_query.content) == std::string::npos) {
            continue;
        }

        if (data.has_duration && (!beatmap->duration.has_value() || beatmap->duration.value() < 0.0)) {
            continue;
        }

        if (data.difficulty_min > 0.0 && beatmap->overall_difficulty < data.difficulty_min) {
            continue;
        }

        if (data.difficulty_max > 0.0 && beatmap->overall_difficulty > data.difficulty_max) {
            continue;
        }

        result.push_back(beatmap);
    }

    return result;
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
