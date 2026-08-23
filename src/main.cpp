#include "ui/ui.hpp"
#include "app/ui/app.hpp"
#include "utils/resources.hpp"

#include <SDL3/SDL.h>
#include <filesystem>
#include <memory>
#include <string>
#include <string_view>

static constexpr ImVec2 DEFAULT_WINDOW_SIZE = {1280.0F, 720.0F};

int main() {
    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMEPAD)) {
        SDL_Log("SDL_Init(): %s", SDL_GetError());
        return 1;
    }

    if (const char* base_path = SDL_GetBasePath()) {
        std::filesystem::current_path(base_path);
    }

    ui::Window::configure_opengl();

    const int exit_code = [&]() {
        const std::filesystem::path resources_path = resources::path();

        ui::RuntimeConfig runtime_config;
        ui::Runtime runtime(std::move(runtime_config));

        static_cast<void>(runtime.add_font(ui::FontType::REGULAR, resources_path / "fonts/Torus-Regular.ttf"));
        static_cast<void>(runtime.add_font(ui::FontType::SEMIBOLD, resources_path / "fonts/Torus-SemiBold.ttf"));
        static_cast<void>(runtime.add_font(ui::FontType::BOLD, resources_path / "fonts/Torus-Bold.ttf"));

        for (const std::string_view id : {"circle-icon", "inspect-icon", "music-icon", "search-icon", "x-icon"}) {
            static_cast<void>(
                runtime.add_resource(std::string{id}, resources_path / "icons/ui/" / (std::string{id} + ".svg"))
            );
        }

        ui::Config config{
            .window = {
                .title = "osu-stuff",
                .size = DEFAULT_WINDOW_SIZE,
                .flags = SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE,
            }
        };

        auto app = std::make_unique<app::OsuStuffApp>(runtime, config);

        SDL_GL_SetSwapInterval(1);

        while (!app->done()) {
            SDL_Event event;

            while (SDL_PollEvent(&event)) {
                app->process_sdl_event(&event);
            }

            runtime.begin_input_frame();
            app->render();
        }

        app.reset();

        return 0;
    }();

    SDL_Quit();
    return exit_code;
}
