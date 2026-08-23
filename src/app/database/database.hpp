#pragma once

#include "../schemas/app.hpp"

#include <cpprealm/db.hpp>
#include <filesystem>
#include <functional>
#include <memory>
#include <utility>

namespace app {
    class AppDatabase {
    public:
        using Config = realm::managed<realm::AppConfig>;

        explicit AppDatabase(std::filesystem::path path);

        void initialize();
        [[nodiscard]] bool initialized() const;
        [[nodiscard]] Config get();

        template <typename Updater>
        void update(Updater&& updater) {
            Config config = get();
            m_database->write([&config, &updater] { std::invoke(std::forward<Updater>(updater), config); });
        }

    private:
        static void ensure_config(realm::db& database);

        std::filesystem::path m_path;
        std::unique_ptr<realm::db> m_database;
    };
} // namespace app
