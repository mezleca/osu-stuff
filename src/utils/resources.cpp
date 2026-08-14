#include "resources.hpp"

#include <cstdlib>

static std::filesystem::path environment_path(const char* name) {
    const char* value = std::getenv(name);
    if (value == nullptr || *value == '\0') {
        return {};
    }

    return value;
}

static std::filesystem::path installed_resources_path() {
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

std::filesystem::path resources::path() {
    const auto local_path = std::filesystem::current_path() / "resources";
    if (std::filesystem::is_directory(local_path)) {
        return local_path;
    }

    const auto installed_path = installed_resources_path();
    if (std::filesystem::is_directory(installed_path)) {
        return installed_path;
    }

    return local_path;
}
