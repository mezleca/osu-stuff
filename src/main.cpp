#include "ui/ui.hpp"

#include <glad/gl.h>
#include <SDL3/SDL.h>
#include <filesystem>
#include <iostream>
#include <memory>

static constexpr int DEFAULT_WIDTH = 1280;
static constexpr int DEFAULT_HEIGHT = 720;

int main() {
    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMEPAD)) {
        std::cout << " SDL_Init(): " << SDL_GetError() << "\n";
        return 1;
    }

    if (const char* base_path = SDL_GetBasePath()) {
        std::filesystem::current_path(base_path);
    }

    SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, 0);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);

    // create window with graphics context
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 16);
    SDL_GL_SetAttribute(SDL_GL_STENCIL_SIZE, 8);

    float main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());
    SDL_WindowFlags window_flags = SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIDDEN;
    SDL_Window* window = SDL_CreateWindow(
        "osu-stuff", (int)(DEFAULT_WIDTH * main_scale), (int)(DEFAULT_HEIGHT * main_scale), window_flags
    );

    if (window == nullptr) {
        std::cout << "SDL_CreateWindow(): " << SDL_GetError() << "\n";
        SDL_Quit();
        return 1;
    }

    SDL_GLContext gl_context = SDL_GL_CreateContext(window);

    if (gl_context == nullptr) {
        std::cout << "SDL_GL_CreateContext(): " << SDL_GetError() << "\n";
        SDL_DestroyWindow(window);
        SDL_Quit();
        return 1;
    }

    SDL_GL_MakeCurrent(window, gl_context);
    SDL_GL_SetSwapInterval(1); // enable vsync
    SDL_SetWindowPosition(window, SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED);
    SDL_ShowWindow(window);

    int version = gladLoadGL(SDL_GL_GetProcAddress);

    if (version == 0) {
        SDL_Log("failed to initialize OpenGL context\n");
        SDL_GL_DestroyContext(gl_context);
        SDL_DestroyWindow(window);
        SDL_Quit();
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

    auto ui = std::make_unique<UI>(&gl_context, window);

    while (!ui->is_done()) {
        SDL_Event event;

        while (SDL_PollEvent(&event)) {
            ui->process_sdl_event(&event);
            if (event.type == SDL_EVENT_QUIT) {
                ui->exit();
            }
            if (event.type == SDL_EVENT_WINDOW_CLOSE_REQUESTED && event.window.windowID == SDL_GetWindowID(window)) {
                ui->exit();
            }
        }

        if (SDL_GetWindowFlags(window) & SDL_WINDOW_MINIMIZED) {
            SDL_Delay(10);
            continue;
        }

        ui->render();
        SDL_GL_SwapWindow(window);

        ui->update_counter();
    }

    ui.reset();

    SDL_GL_DestroyContext(gl_context);
    SDL_DestroyWindow(window);
    SDL_Quit();

    return 0;
}
