#pragma once

#include "style/theme.hpp"
#include "runtime.hpp"
#include "imgui/input-bridge.hpp"
#include "platform/window.hpp"
#include "resources/assets.hpp"

#include <glad/gl.h>
#include <imgui.h>
#include <SDL3/SDL_events.h>
#include <SDL3/SDL_video.h>
#include <memory>
#include <string>

class UI;
class IconTexture;

namespace ui {
    struct WindowConfig {
        std::string title;
        ImVec2 size{};
        Window* shared_context_with = nullptr;
        SDL_WindowFlags flags = 0;
    };

    struct Config {
        WindowConfig window;
    };
} // namespace ui

class UI {
public:
    UI(ui::Runtime& runtime, ui::Config config);
    ~UI();

    UI(const UI&) = delete;
    UI& operator=(const UI&) = delete;

    void exit() {
        m_done = true;
    }

    // clears this surface's per-frame input state before the next render pass.
    void begin_input_frame();

    // makes this surface current and starts its imgui frame.
    // call once before drawing the root node.
    void begin_frame();

    // renders and presents the current imgui frame, then restores the previous context.
    void end_frame();

    // feeds an sdl event to imgui and dispatches the corresponding ui event.
    void process_sdl_event(SDL_Event* event);

    [[nodiscard]] bool is_done() const {
        return m_done;
    }

    [[nodiscard]] bool ready() const {
        return m_ready;
    }

    [[nodiscard]] ui::Font& get_font(ui::FontType type) {
        return m_runtime.assets().font(type, m_context, m_io);
    }

    [[nodiscard]] const ui::Font& get_font(ui::FontType type) const {
        return m_runtime.assets().font(type, m_context, m_io);
    }

    [[nodiscard]] ui::ImGuiInputBridge& input() {
        return m_imgui_input;
    }

    [[nodiscard]] ui::InputRouter& input_router() {
        return m_input_router;
    }

    [[nodiscard]] const ui::Theme& theme() const {
        return m_runtime.theme();
    }

    [[nodiscard]] ui::Runtime& runtime() {
        return m_runtime;
    }

    [[nodiscard]] ui::Node& root() {
        return *m_container;
    }

    [[nodiscard]] ui::Window* window() {
        return m_window.get();
    }

    [[nodiscard]] ImGuiContext* imgui_context() {
        return m_context;
    }

    [[nodiscard]] IconTexture* get_texture(std::string_view id);

    void load_theme(ui::Theme theme);
    void refresh_theme();

private:
    void initialize();
    void configure_style(float main_scale);
    void apply_theme_colors();

    ui::Runtime& m_runtime;
    ImGuiContext* m_context = nullptr;
    ImGuiContext* m_previous_context = nullptr;
    ImGuiIO* m_io = nullptr;
    std::unique_ptr<ui::Window> m_window;
    std::unique_ptr<ui::Node> m_container;
    ui::InputRouter m_input_router;
    ui::ImGuiInputBridge m_imgui_input;
    ui::Config m_config;
    bool m_done = false;
    bool m_ready = false;
};
