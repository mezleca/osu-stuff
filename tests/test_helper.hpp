#pragma once

#include <filesystem>

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

    inline std::filesystem::path temp_root() {
        return std::filesystem::current_path() / "temp";
    }
} // namespace test_helper
