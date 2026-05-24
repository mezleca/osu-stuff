#pragma once

#include "client.hpp"

#include <filesystem>
#include <vector>

class StableClient : public ClientBase {
  public:
    explicit StableClient(ClientOptions options);

    [[nodiscard]] const char* player_name() const override;
    [[nodiscard]] std::vector<std::string>
    fetch_missing_beatmaps_from_collections(std::string_view collection_name) override;
    [[nodiscard]] bool update_collection() override;

  private:
    void load_beatmaps(const std::filesystem::path& database_path);
    void load_collections(const std::filesystem::path& database_path);

    ClientOptions m_options;
    std::string m_player_name;
};
