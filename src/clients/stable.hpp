#pragma once

#include "client.hpp"

#include <vector>

class StableClient : public ClientBase {
  public:
    explicit StableClient(ClientOptions options);

    [[nodiscard]] const char* player_name() const override;
    [[nodiscard]] std::vector<std::string> search_beatmaps(const SearchOptions& options) override;
    [[nodiscard]] std::vector<std::string> get_missing_beatmaps(std::string_view collection_name) override;

  private:
    ClientOptions m_options;
    std::string m_player_name;
};
