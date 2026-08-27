#pragma once

#include <filesystem>

namespace paths {
    [[nodiscard]] std::filesystem::path app_data();
    [[nodiscard]] std::filesystem::path local_resources();
    [[nodiscard]] std::filesystem::path installed_resources();
} // namespace paths
