#pragma once

#include <SDL3/SDL_video.h>
#include <imgui.h>

#include <string>

namespace ui {
    // owns an sdl window and its opengl context. construction optionally
    // shares resources with another window and restores the caller's current
    // context before returning.
    class Window {
    public:
        Window(std::string title, ImVec2 size, SDL_WindowFlags flags, Window* shared_with = nullptr);
        ~Window();

        Window(const Window&) = delete;
        Window& operator=(const Window&) = delete;

        [[nodiscard]] bool valid() const;
        [[nodiscard]] SDL_Window* handle() const;
        [[nodiscard]] SDL_GLContext context() const;
        [[nodiscard]] SDL_WindowID id() const;
        [[nodiscard]] SDL_WindowFlags flags() const;
        [[nodiscard]] ImVec2 display_size() const;

        void make_current();
        void show();
        void hide();
        void raise();
        void swap();

        static void configure_opengl();

    private:
        SDL_Window* m_window = nullptr;
        SDL_GLContext m_context = nullptr;
    };
} // namespace ui
