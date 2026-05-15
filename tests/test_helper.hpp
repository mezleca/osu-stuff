#pragma once

#include <chrono>
#include <filesystem>
#include <string>

namespace test_helper {
    inline std::filesystem::path data_root() {
        return std::filesystem::current_path() / "data";
    }

    inline std::filesystem::path osu_root() {
        return data_root() / "osu";
    }

    inline std::filesystem::path lazer_root() {
        return data_root() / "lazer";
    }

    class TempDir {
      public:
        explicit TempDir(std::string name) {
            const auto timestamp = std::chrono::steady_clock::now().time_since_epoch().count();
            m_path =
                std::filesystem::temp_directory_path() / std::filesystem::path(name + "-" + std::to_string(timestamp));
            std::filesystem::create_directories(m_path);
        }

        ~TempDir() {
            std::error_code error;
            std::filesystem::remove_all(m_path, error);
        }

        [[nodiscard]] const std::filesystem::path& path() const {
            return m_path;
        }

      private:
        std::filesystem::path m_path;
    };
} // namespace test_helper
