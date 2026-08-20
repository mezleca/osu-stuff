#pragma once

#include "style/theme.hpp"
#include "diagnostics/profiler.hpp"
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
    class Node;

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

/// assets and theme remain owned by Runtime; imgui context, root and router are surface-local.
class UI {
public:
    UI(ui::Runtime& runtime, ui::Config config);
    ~UI();

    UI(const UI&) = delete;
    UI& operator=(const UI&) = delete;

    void exit() {
        m_done = true;
    }

    /// clears this surface's per-frame input state before the next render pass.
    void begin_input_frame();

    /// makes this surface current and starts its imgui frame.
    /// call once before updating and drawing the root node.
    void begin_frame();

    /// presents the imgui frame, then restores the previous context.
    void end_frame();

    /// feeds an sdl event to imgui and dispatches the corresponding ui event.
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

    [[nodiscard]] ui::Profiler& profiler() {
        return m_profiler;
    }

    [[nodiscard]] const ui::Profiler& profiler() const {
        return m_profiler;
    }

    [[nodiscard]] const ui::Theme& theme() const {
        return m_runtime.theme();
    }

    [[nodiscard]] ui::Runtime& runtime() {
        return m_runtime;
    }

    /// application nodes should normally be owned below this retained root.
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

    void set_frame_style(ImVec2 padding, float rounding, float border_thickness);
    void set_grab_style(float minimum_size, float rounding);
    void set_item_spacing(ImVec2 spacing, ImVec2 inner_spacing);

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
    ui::Profiler m_profiler;
    ui::Config m_config;
    bool m_done = false;
    bool m_ready = false;
};
