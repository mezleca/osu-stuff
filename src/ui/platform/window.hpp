#pragma once

#include <SDL3/SDL_video.h>
#include <imgui.h>

#include <string>

namespace ui {
    class Window {
    public:
        Window(std::string title, ImVec2 size, SDL_WindowFlags flags, Window* shared_with = nullptr);
        Window(const Window&) = delete;
        ~Window();

        Window& operator=(const Window&) = delete;

        [[nodiscard]] bool valid() const;
        [[nodiscard]] SDL_Window* handle() const;
        [[nodiscard]] SDL_GLContext context() const;
        [[nodiscard]] SDL_WindowID id() const;
        [[nodiscard]] ImVec2 display_size() const;

        void make_current();
        void set_position(int x, int y);
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
