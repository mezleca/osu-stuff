#pragma once

#include "change.hpp"
#include "../schemas/app.hpp"

#include <cpprealm/db.hpp>
#include <chrono>
#include <filesystem>
#include <functional>
#include <memory>
#include <type_traits>
#include <utility>

namespace app {
    template <typename Value>
    class DatabaseBinding {
    public:
        using Loader = std::function<Value()>;
        using Saver = std::function<void(const Value&)>;

        DatabaseBinding(Loader loader, Saver saver)
            : m_loader(std::move(loader)), m_saver(std::move(saver)), m_value(m_loader()) {}

        [[nodiscard]] Value& value() {
            return m_value;
        }

        [[nodiscard]] const Value& value() const {
            return m_value;
        }

        void commit() {
            m_saver(m_value);
        }

        void refresh() {
            m_value = m_loader();
        }

    private:
        Loader m_loader;
        Saver m_saver;
        Value m_value;
    };

    class AppDatabase {
    public:
        using Config = realm::managed<realm::AppConfig>;

        explicit AppDatabase(std::filesystem::path path);

        void initialize();
        [[nodiscard]] bool initialized() const;
        [[nodiscard]] Config get();
        [[nodiscard]] Config* get_ptr();
        [[nodiscard]] std::chrono::time_point<std::chrono::system_clock> last_update() const;

        template <typename Loader, typename Saver>
        auto bind(Loader loader, Saver saver);

        template <typename Updater>
        void update(Updater&& updater) {
            Config config = get();

            m_database->write([this, &config, &updater] {
                DatabaseChange change;
                std::invoke(std::forward<Updater>(updater), change, config);

                if (!change.changed()) {
                    return;
                }

                config.last_updated = std::chrono::system_clock::now();
                m_last_update = config.last_updated.detach();
            });
        }

    private:
        static void ensure_config(realm::db& database);

        std::filesystem::path m_path;
        std::unique_ptr<realm::db> m_database;
        std::unique_ptr<Config> m_config;
        std::chrono::time_point<std::chrono::system_clock> m_last_update{};
    };

    extern AppDatabase* database;

    template <typename Loader, typename Saver>
    auto AppDatabase::bind(Loader loader, Saver saver) {
        using Value = std::decay_t<std::invoke_result_t<Loader&, Config&>>;

        auto load_value = [this, loader]() -> Value {
            Config config = get();
            return std::invoke(loader, config);
        };

        auto save_value = [this, saver](const Value& value) {
            update([saver, &value](DatabaseChange& change, Config& config) { std::invoke(saver, change, config, value); });
        };

        return DatabaseBinding<Value>(std::move(load_value), std::move(save_value));
    }
} // namespace app

#define DATABASE_FIELD(database, field)                                                                                          \
    (database)->bind(                                                                                                            \
        [](auto& config) { return (config.field).detach(); },                                                                    \
        [](auto& change, auto& config, auto value) { change.set((config.field), value); }                                        \
    )
