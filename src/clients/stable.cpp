#include "stable.hpp"

#include <utility>

StableClient::StableClient(ClientOptions options)
    : m_options(std::move(options)) {
  if (m_options.osu_path.empty()) {
  }
}

const char *StableClient::player_name() const { return m_player_name.c_str(); }

std::vector<std::string> StableClient::search_beatmaps(const SearchOptions &) {
  return {};
}

std::vector<std::string> StableClient::get_missing_beatmaps(std::string_view) {
  return {};
}
