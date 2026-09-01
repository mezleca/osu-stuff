#include <ui/ui.hpp>
#include <ui/backends/sdl/backend.hpp>
#include <ui/backends/sdl/icon.hpp>
#include "database/database.hpp"
#include "ui/app.hpp"
#include "utils/log.hpp"
#include "utils/paths.hpp"

#include <SDL3/SDL.h>
#include <nfd.hpp>
#include <filesystem>
#include <memory>
#include <string>
#include <string_view>

int main() {
    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMEPAD)) {
        LOG_ERROR("SDL_Init(): {}", SDL_GetError());
        return 1;
    }

    // initialize nfd
    NFD::Guard nfdGuard;

    if (const char* base_path = SDL_GetBasePath()) {
        std::filesystem::current_path(base_path);
    }

    SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, 0);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 16);
    SDL_GL_SetAttribute(SDL_GL_STENCIL_SIZE, 8);

    ui::set_backend(ui::create_sdl_backend);

    const int exit_code = [&]() {
        const auto local_resources = paths::local_resources();
        const auto installed_resources = paths::installed_resources();
        const std::filesystem::path resources_path =
            std::filesystem::is_directory(local_resources)
                ? local_resources
                : (std::filesystem::is_directory(installed_resources) ? installed_resources : local_resources);

        ui::RuntimeConfig runtime_config;
        runtime_config.icon_loader = ui::make_sdl_icon_loader();
        ui::Runtime runtime(std::move(runtime_config));

        runtime.add_font(ui::FontType::REGULAR, resources_path / "fonts/Torus-Regular.ttf");
        runtime.add_font(ui::FontType::SEMIBOLD, resources_path / "fonts/Torus-SemiBold.ttf");
        runtime.add_font(ui::FontType::BOLD, resources_path / "fonts/Torus-Bold.ttf");

        for (const std::string_view id : {"chevron-icon", "circle-icon", "inspect-icon", "music-icon", "search-icon", "x-icon"}) {
            runtime.add_resource(std::string{id}, resources_path / "icons/ui/" / (std::string{id} + ".svg"));
        }

        ui::Config config{
            .title = "osu-stuff",
            .size = {1280.0F, 720.0F},
            .resizable = true,
        };

        app::AppDatabase database_instance(paths::app_data() / "osu-stuff" / "realm" / "database.realm");
        database_instance.initialize();
        app::database = &database_instance;

        auto app = std::make_unique<app::AppUI>(runtime, config);

        while (!app->done()) {
            SDL_Event event;

            while (SDL_PollEvent(&event)) {
                app->process_sdl_event(&event);
            }

            app->render();
        }

        app.reset();

        return 0;
    }();

    SDL_Quit();
    return exit_code;
}
