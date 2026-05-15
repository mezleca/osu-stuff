#include "client.hpp"
#include "../utils/binary.hpp"

void ClientBase::fill_criteria_table() {
#define X(type, name, ...)                                                     \
  for (auto var : {#name __VA_OPT__(, ) __VA_ARGS__}) {                        \
    criteria_table[var][QueryOp::EQ] = [](const OsuBeatmap &s,                 \
                                          std::string_view v) {                \
      return binary::lower_if_possible(s.name) == binary::convert_to<type>(v); \
    };                                                                         \
    criteria_table[var][QueryOp::NEQ] = [](const OsuBeatmap &s,                \
                                           std::string_view v) {               \
      return binary::lower_if_possible(s.name) != binary::convert_to<type>(v); \
    };                                                                         \
    criteria_table[var][QueryOp::GTE] = [](const OsuBeatmap &s,                \
                                           std::string_view v) {               \
      return binary::lower_if_possible(s.name) >= binary::convert_to<type>(v); \
    };                                                                         \
    criteria_table[var][QueryOp::GT] = [](const OsuBeatmap &s,                 \
                                          std::string_view v) {                \
      return binary::lower_if_possible(s.name) > binary::convert_to<type>(v);  \
    };                                                                         \
    criteria_table[var][QueryOp::LTE] = [](const OsuBeatmap &s,                \
                                           std::string_view v) {               \
      return binary::lower_if_possible(s.name) <= binary::convert_to<type>(v); \
    };                                                                         \
    criteria_table[var][QueryOp::LT] = [](const OsuBeatmap &s,                 \
                                          std::string_view v) {                \
      return binary::lower_if_possible(s.name) < binary::convert_to<type>(v);  \
    };                                                                         \
  }
  CRITERIA_FIELDS
#undef X
}

std::vector<OsuBeatmap *> ClientBase::search_beatmaps(SearchOptions data) {
  std::vector<OsuBeatmap *> result;
  QueryState state;

  std::string a = binary::lower_if_possible(data.query);
  std::string_view normalized_query(a);

  ParsedQuery p_query = query::parse(normalized_query);

  for (auto &it : m_beatmaps) {
    OsuBeatmap *beatmap = it.second.get();
    bool match_token = true;

    for (const auto &token : p_query.tokens) {
      auto t_it = criteria_table.find(token.key);
      if (t_it == criteria_table.end())
        continue;

      if (t_it->second[token.op](*beatmap, token.value)) {
        match_token = true;
        break;
      }
    }

    if (!match_token) {
      continue;
    }

    if (beatmap->searchable.find(p_query.content) == std::string::npos) {
      continue;
    }

    result.push_back(beatmap);
  }

  return result;
}
