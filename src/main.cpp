#include "ui/ui.hpp"
#include "app/ui/app.hpp"
#include "utils/resources.hpp"

#include <glad/gl.h>
#include <SDL3/SDL.h>
#include <filesystem>
#include <memory>

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

    float main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());
    const SDL_WindowFlags window_flags = SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIDDEN;
    const int exit_code = [&]() {
        ui::Window window(
            "osu-stuff", {DEFAULT_WINDOW_SIZE.x * main_scale, DEFAULT_WINDOW_SIZE.y * main_scale}, window_flags
        );

        if (!window.valid()) {
            SDL_Log("failed to initialize main window");
            return 1;
        }

        window.make_current();
        SDL_SetWindowPosition(window.handle(), SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED);
        window.show();

        int version = gladLoadGL(SDL_GL_GetProcAddress);

        if (version == 0) {
            SDL_Log("failed to initialize OpenGL context\n");
            return -1;
        }

        // sdl / opengl debug
        {
            int maj, min;
            SDL_Log("Vendor   : %s", glGetString(GL_VENDOR));
            SDL_Log("Renderer : %s", glGetString(GL_RENDERER));
            SDL_Log("Version  : %s", glGetString(GL_VERSION));
            SDL_Log("GLSL     : %s", glGetString(GL_SHADING_LANGUAGE_VERSION));
            SDL_GL_GetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, &maj);
            SDL_GL_GetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, &min);
            SDL_Log("SDL Context  : %d.%d", maj, min);

            glGetIntegerv(GL_MAJOR_VERSION, &maj);
            glGetIntegerv(GL_MINOR_VERSION, &min);
            SDL_Log("GL Context  : %d.%d", maj, min);
        }

        const std::filesystem::path resources_path = resources::path();

        ui::Config ui_config{
            .font_paths =
                {resources_path / "fonts/Torus-Regular.ttf", resources_path / "fonts/Torus-SemiBold.ttf",
                 resources_path / "fonts/Torus-Bold.ttf"},
            .icon_path = resources_path / "icons/ui/",
        };
        auto ui = std::make_unique<UI>(window, std::move(ui_config));

        if (!ui->ready()) {
            SDL_Log("UI initialization failed");
            return 1;
        }

        // set the main context interval after creating the debugger context.
        SDL_GL_SetSwapInterval(1);

        auto app = std::make_unique<app::OsuStuffApp>(*ui);

        while (!ui->is_done()) {
            SDL_Event event;

            while (SDL_PollEvent(&event)) {
                ui->process_sdl_event(&event);
                if (event.type == SDL_EVENT_QUIT) {
                    ui->exit();
                }
                if (event.type == SDL_EVENT_WINDOW_CLOSE_REQUESTED && event.window.windowID == window.id()) {
                    ui->exit();
                }
            }

            if (window.flags() & SDL_WINDOW_MINIMIZED) {
                SDL_Delay(10);
                continue;
            }

            app->render();
            window.swap();
        }

        app.reset();
        ui.reset();

        return 0;
    }();

    SDL_Quit();
    return exit_code;
}
