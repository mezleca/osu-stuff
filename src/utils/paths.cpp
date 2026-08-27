#include "paths.hpp"

#include <cstdlib>

static std::filesystem::path environment_path(const char* name) {
    const char* value = std::getenv(name);
    if (value == nullptr || *value == '\0') {
        return {};
    }

    return value;
}

std::filesystem::path paths::installed_resources() {
#ifdef _WIN32
    auto path = environment_path("PROGRAMFILES");
    if (path.empty()) {
        path = environment_path("PROGRAMW6432");
    }

    if (path.empty()) {
        return {};
    }

    return path / "osu-stuff" / "resources";
#else
    const auto app_dir = environment_path("APPDIR");
    if (!app_dir.empty()) {
        return app_dir / "usr" / "share" / "osu-stuff" / "resources";
    }

    const std::filesystem::path flatpak_path = "/app/share/osu-stuff/resources";
    if (std::filesystem::is_directory(flatpak_path)) {
        return flatpak_path;
    }

    return "/usr/share/osu-stuff/resources";
#endif
}

std::filesystem::path paths::app_data() {
#ifdef _WIN32
    return environment_path("APPDATA");
#else
    const auto home = environment_path("HOME");
    if (home.empty()) {
        return {};
    }

    return home / ".local" / "share";
#endif
}

std::filesystem::path paths::local_resources() {
    return std::filesystem::current_path() / "resources";
}
