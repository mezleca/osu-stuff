#include <ui/ui.hpp>
#include <ui/backends/opengl/texture-loader.hpp>
#include <ui/backends/sdl/backend.hpp>
#include "database/database.hpp"
#include "ui/app.hpp"
#include "ui/theme.hpp"
#include "utils/log.hpp"
#include "utils/paths.hpp"

#include <SDL3/SDL.h>
#include <filesystem>
#include <memory>

using namespace ui;

static int run_app() {
    const auto local_resources = paths::local_resources();
    const auto installed_resources = paths::installed_resources();
    const auto resources_path =
        std::filesystem::is_directory(installed_resources) && !std::filesystem::is_directory(local_resources)
            ? installed_resources
            : local_resources;

    Runtime runtime({
        .theme = make_theme(),
        .texture_loader = std::make_unique<OpenGLTextureLoader>(),
    });

    runtime.fonts().add("Torus Regular", resources_path / "fonts/Torus-Regular.ttf");
    runtime.fonts().add("Torus SemiBold", resources_path / "fonts/Torus-SemiBold.ttf");
    runtime.fonts().add("Torus Bold", resources_path / "fonts/Torus-Bold.ttf");

    for (const auto& icon : std::filesystem::directory_iterator(resources_path / "icons/ui")) {
        if (icon.is_regular_file() && icon.path().extension() == ".svg") {
            runtime.textures().add(icon.path().stem().string(), icon.path());
        }
    }

    AppDatabase database_instance(paths::app_data() / "osu-stuff" / "realm" / "database.realm");
    database_instance.initialize();
    database = &database_instance;

    BackendConfig config = {
        .title = "osu-stuff",
        .size = {1280.0F, 720.0F},
        .resizable = true
    };

    AppUI app(runtime, std::make_unique<SdlBackend>(config));

    if (!app.ready()) {
        return 1;
    }

    while (!app.done()) {
        SDL_Event event;

        while (SDL_PollEvent(&event)) {
            app.process_sdl_event(&event);
        }

        app.render();
    }

    return 0;
}

int main() {
    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMEPAD)) {
        LOG_ERROR("SDL_Init(): {}", SDL_GetError());
        return 1;
    }

    if (const char* base_path = SDL_GetBasePath()) {
        std::filesystem::current_path(base_path);
    }

    const auto exit_code = run_app();
    SDL_Quit();
    return exit_code;
}
