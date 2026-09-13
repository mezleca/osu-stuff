#include <ui/ui.hpp>
#include <ui/backends/opengl/texture-loader.hpp>
#include <ui/backends/sdl/backend.hpp>
#include "audio/audio-manager.hpp"
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

    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);

    SDL_Window* window = SDL_CreateWindow("osu-stuff", 1280, 720, SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE);
    if (window == nullptr) {
        LOG_ERROR("SDL_CreateWindow(): {}", SDL_GetError());
        return 1;
    }

    SDL_GLContext context = SDL_GL_CreateContext(window);
    if (context == nullptr) {
        LOG_ERROR("SDL_GL_CreateContext(): {}", SDL_GetError());
        SDL_DestroyWindow(window);
        return 1;
    }

    SDL_GL_MakeCurrent(window, context);
    SDL_GL_SetSwapInterval(1);

    {
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

        AppUI app(runtime, std::make_unique<SdlBackend>(window, context));
        while (!app.done()) {
            app.process_events();
            app.render();
        }
    }

    SDL_GL_DestroyContext(context);
    SDL_DestroyWindow(window);
    return 0;
}

int main() {
    SDL_SetHint(SDL_HINT_MAIN_CALLBACK_RATE, "5");

    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMEPAD)) {
        LOG_ERROR("SDL_Init(): {}", SDL_GetError());
        return 1;
    }

    if (!AudioManager::instance().ready()) {
        LOG_ERROR("AudioManager: {}", SDL_GetError());
        SDL_Quit();
        return 1;
    }

    if (const char* base_path = SDL_GetBasePath()) {
        std::filesystem::current_path(base_path);
    }

    const int status = run_app();
    SDL_Quit();
    return status;
}
