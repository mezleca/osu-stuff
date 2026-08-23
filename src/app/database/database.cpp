#include "database.hpp"

#include <stdexcept>

namespace app {
    AppDatabase::AppDatabase(std::filesystem::path path) : m_path(std::move(path)) {}

    void AppDatabase::initialize() {
        if (m_database != nullptr) {
            return;
        }

        if (const std::filesystem::path parent = m_path.parent_path(); !parent.empty()) {
            std::filesystem::create_directories(parent);
        }

        realm::db_config config;
        config.set_path(m_path.string());

        auto database = std::make_unique<realm::db>(
            realm::open<
                realm::AppConfig, realm::AppOsuCredentials, realm::AppProcessedBeatmap, realm::AppOsuData,
                realm::AppPlaylistSong, realm::AppPlaylist, realm::AppRadioData>(config)
        );
        ensure_config(*database);
        m_database = std::move(database);
    }

    bool AppDatabase::initialized() const {
        return m_database != nullptr;
    }

    AppDatabase::Config AppDatabase::get() {
        if (!initialized()) {
            throw std::logic_error("app database is not initialized");
        }

        auto configs = m_database->objects<realm::AppConfig>().where([](auto& config) { return config._id == 0; });
        if (configs.size() != 1) {
            throw std::runtime_error("app database config is missing");
        }

        return configs[0];
    }

    void AppDatabase::ensure_config(realm::db& database) {
        auto configs = database.objects<realm::AppConfig>().where([](auto& config) { return config._id == 0; });
        if (configs.size() == 0) {
            realm::AppOsuCredentials credentials;
            realm::AppOsuData osu_data;
            realm::AppRadioData radio;
            realm::AppConfig config;
            config.credentials = &credentials;
            config.osu_data = &osu_data;
            config.radio = &radio;

            database.write([&database, &config] { database.add(std::move(config)); });
            return;
        }

        Config config = configs[0];
        if (config.credentials && config.osu_data && config.radio) {
            return;
        }

        database.write([&config] {
            realm::AppOsuCredentials credentials;
            realm::AppOsuData osu_data;
            realm::AppRadioData radio;

            if (!config.credentials) {
                config.credentials = &credentials;
            }
            if (!config.osu_data) {
                config.osu_data = &osu_data;
            }
            if (!config.radio) {
                config.radio = &radio;
            }
        });
    }
} // namespace app
