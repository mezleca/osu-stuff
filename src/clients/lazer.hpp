#pragma once

#include "client.hpp"

#include <memory>
#include <string>
#include <vector>

namespace realm {
    struct db;
}

class LazerClient : public ClientBase {
  public:
    explicit LazerClient(ClientOptions options);
    ~LazerClient() override;

    [[nodiscard]] const char* player_name() const override;
    [[nodiscard]] std::vector<std::string> get_missing_beatmaps(std::string_view collection_name) override;
    [[nodiscard]] bool update_collection() override;

  private:
    ClientOptions m_options;
    std::string m_player_name;
    std::unique_ptr<realm::db> m_realm;
};
