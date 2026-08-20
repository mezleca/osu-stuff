#include "runtime.hpp"

#include "ui.hpp"

#include <algorithm>
#include <utility>

namespace ui {
    static SDL_WindowID event_window_id(const SDL_Event& event) {
        if (event.type >= SDL_EVENT_WINDOW_FIRST && event.type <= SDL_EVENT_WINDOW_LAST) {
            return event.window.windowID;
        }

        switch (event.type) {
            case SDL_EVENT_KEY_DOWN:
            case SDL_EVENT_KEY_UP:
                return event.key.windowID;
            case SDL_EVENT_TEXT_INPUT:
                return event.text.windowID;
            case SDL_EVENT_MOUSE_MOTION:
                return event.motion.windowID;
            case SDL_EVENT_MOUSE_BUTTON_DOWN:
            case SDL_EVENT_MOUSE_BUTTON_UP:
                return event.button.windowID;
            case SDL_EVENT_MOUSE_WHEEL:
                return event.wheel.windowID;
            default:
                return 0;
        }
    }

    Runtime::Runtime(RuntimeConfig config)
        : m_theme(std::move(config.theme)), m_assets(std::move(config.font_paths), std::move(config.icon_path)),
          m_performance_directory(std::move(config.performance_directory)) {}

    Runtime::~Runtime() = default;

    void Runtime::begin_input_frame() {
        for (UI* surface : m_surfaces) {
            surface->begin_input_frame();
        }
    }

    void Runtime::process_sdl_event(SDL_Event* event) {
        if (event == nullptr) {
            return;
        }

        if (event->type == SDL_EVENT_QUIT) {
            for (UI* surface : m_surfaces) {
                surface->exit();
            }
            return;
        }

        const SDL_WindowID window_id = event_window_id(*event);
        if (window_id == 0) {
            return;
        }

        for (UI* surface : m_surfaces) {
            if (surface->window() != nullptr && surface->window()->id() == window_id) {
                surface->process_sdl_event(event);
                return;
            }
        }
    }

    void Runtime::register_surface(UI& surface) {
        m_surfaces.push_back(&surface);
    }

    void Runtime::unregister_surface(UI& surface) {
        const auto it = std::find(m_surfaces.begin(), m_surfaces.end(), &surface);
        if (it != m_surfaces.end()) {
            m_surfaces.erase(it);
        }
    }

    void Runtime::release_context(ImGuiContext* context, SDL_GLContext gl_context) {
        m_assets.release_context(context, gl_context);
    }
} // namespace ui
