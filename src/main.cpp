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
#include <string>
#include <string_view>

using namespace ui;

int main() {
    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMEPAD)) {
        LOG_ERROR("SDL_Init(): {}", SDL_GetError());
        return 1;
    }

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

    const int exit_code = [&]() {
        const auto local_resources = paths::local_resources();
        const auto installed_resources = paths::installed_resources();
        std::filesystem::path resources_path = local_resources;
        if (std::filesystem::is_directory(installed_resources) && !std::filesystem::is_directory(local_resources)) {
            resources_path = installed_resources;
        }

        RuntimeConfig runtime_config;
        runtime_config.theme = make_theme();
        runtime_config.texture_loader = std::make_unique<OpenGLTextureLoader>();
        Runtime runtime(std::move(runtime_config));

        runtime.fonts().add("Torus Regular", resources_path / "fonts/Torus-Regular.ttf");
        runtime.fonts().add("Torus SemiBold", resources_path / "fonts/Torus-SemiBold.ttf");
        runtime.fonts().add("Torus Bold", resources_path / "fonts/Torus-Bold.ttf");

        for (const std::string_view id : {"chevron-icon", "circle-icon", "inspect-icon", "music-icon", "search-icon", "x-icon"}) {
            runtime.textures().add(std::string{id}, resources_path / "icons/ui/" / (std::string{id} + ".svg"));
        }

        auto backend = std::make_unique<SdlBackend>(BackendConfig{
            .title = "osu-stuff",
            .size = {1280.0F, 720.0F},
            .resizable = true,
        });

        AppDatabase database_instance(paths::app_data() / "osu-stuff" / "realm" / "database.realm");
        database_instance.initialize();
        database = &database_instance;

        auto app = std::make_unique<AppUI>(runtime, std::move(backend));

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
