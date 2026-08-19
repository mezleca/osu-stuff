#include "window.hpp"

#include <SDL3/SDL_log.h>
#include <imgui.h>

namespace ui {
    Window::Window(std::string title, ImVec2 size, SDL_WindowFlags flags, Window* shared_with) {
        const bool sharing_context = shared_with != nullptr;

        SDL_Window* previous_window = SDL_GL_GetCurrentWindow();
        SDL_GLContext previous_context = SDL_GL_GetCurrentContext();

        if (sharing_context && !shared_with->valid()) {
            SDL_Log("cannot share OpenGL context with an invalid window");
            return;
        }

        // sdl shares resources with the context current at window creation.
        if (sharing_context) {
            shared_with->make_current();
        }

        if (!SDL_GL_SetAttribute(SDL_GL_SHARE_WITH_CURRENT_CONTEXT, sharing_context ? 1 : 0)) {
            SDL_Log("SDL_GL_SetAttribute(SDL_GL_SHARE_WITH_CURRENT_CONTEXT): %s", SDL_GetError());
            if (previous_window != nullptr) SDL_GL_MakeCurrent(previous_window, previous_context);
            return;
        }

        m_window = SDL_CreateWindow(title.c_str(), size.x, size.y, flags);

        if (m_window == nullptr) {
            SDL_Log("SDL_CreateWindow(%s): %s", title.c_str(), SDL_GetError());
            if (!SDL_GL_SetAttribute(SDL_GL_SHARE_WITH_CURRENT_CONTEXT, 0)) {
                SDL_Log("SDL_GL_SetAttribute(SDL_GL_SHARE_WITH_CURRENT_CONTEXT): %s", SDL_GetError());
            }
            return;
        }

        m_context = SDL_GL_CreateContext(m_window);

        if (sharing_context && !SDL_GL_SetAttribute(SDL_GL_SHARE_WITH_CURRENT_CONTEXT, 0)) {
            SDL_Log("SDL_GL_SetAttribute(SDL_GL_SHARE_WITH_CURRENT_CONTEXT): %s", SDL_GetError());
        }

        if (m_context == nullptr) {
            SDL_Log("SDL_GL_CreateContext(%s): %s", title.c_str(), SDL_GetError());
            SDL_DestroyWindow(m_window);

            m_window = nullptr;
            if (previous_window != nullptr) SDL_GL_MakeCurrent(previous_window, previous_context);
            return;
        }

        if (previous_window != nullptr) {
            SDL_GL_MakeCurrent(previous_window, previous_context);
        }
    }

    Window::~Window() {
        if (m_context != nullptr) SDL_GL_DestroyContext(m_context);
        if (m_window != nullptr) SDL_DestroyWindow(m_window);
    }

    bool Window::valid() const {
        return m_window != nullptr && m_context != nullptr;
    }

    SDL_Window* Window::handle() const {
        return m_window;
    }

    SDL_GLContext Window::context() const {
        return m_context;
    }

    SDL_WindowID Window::id() const {
        return m_window == nullptr ? 0 : SDL_GetWindowID(m_window);
    }

    ImVec2 Window::display_size() const {
        if (m_window == nullptr) {
            return {};
        }

        int width = 0;
        int height = 0;
        SDL_GetWindowSizeInPixels(m_window, &width, &height);
        return {static_cast<float>(width), static_cast<float>(height)};
    }

    void Window::make_current() {
        if (valid()) {
            SDL_GL_MakeCurrent(m_window, m_context);
        }
    }

    void Window::set_position(int x, int y) {
        if (m_window != nullptr) {
            SDL_SetWindowPosition(m_window, x, y);
        }
    }

    void Window::show() {
        if (m_window != nullptr) {
            SDL_ShowWindow(m_window);
        }
    }

    void Window::hide() {
        if (m_window != nullptr) {
            SDL_HideWindow(m_window);
        }
    }

    void Window::raise() {
        if (m_window != nullptr) {
            SDL_RaiseWindow(m_window);
        }
    }

    void Window::swap() {
        if (m_window != nullptr) {
            SDL_GL_SwapWindow(m_window);
        }
    }

    void Window::configure_opengl() {
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, 0);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);
        SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
        SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 16);
        SDL_GL_SetAttribute(SDL_GL_STENCIL_SIZE, 8);
    }
} // namespace ui
