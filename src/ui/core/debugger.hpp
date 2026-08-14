#pragma once

#include "root.hpp"
#include "window.hpp"
#include "../widgets/image.hpp"

#include <SDL3/SDL_events.h>
#include <imgui.h>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace ui {
    class Debugger {
    public:
        Debugger(UiRoot& root, Window& main_window);
        ~Debugger();

        void set_icon(IconTexture* icon);
        void set_close_icon(IconTexture* icon);
        void set_style(const ImGuiStyle& style);
        void set_font(std::string_view path, float size, const ImFontConfig& config);
        void set_bold_font(std::string_view path, float size, const ImFontConfig& config);
        void process_event(const SDL_Event* event);
        void shutdown();
        void update();
        void render();

    private:
        void render_node_list(Node& node, int depth);
        void render_properties();
        void render_node_properties();
        void render_layout_properties();
        void render_style_properties();
        void render_style_variables(const Style& style);
        void set_enabled(bool enabled);
        bool handle_select_event(const SDL_Event& event, bool mouse_event, SDL_WindowID main_window_id);
        void set_select_mode(bool enabled, bool wait_for_release = false);
        [[nodiscard]] bool ready() const;

        UiRoot& m_root;
        Window& m_main_window;
        std::unique_ptr<Window> m_window;
        ImGuiContext* m_context = nullptr;
        ImageWidget m_icon;
        ImageWidget m_close_icon;
        ImFont* m_font = nullptr;
        ImFont* m_bold_font = nullptr;
        Node* m_target = nullptr;
        bool m_enabled = false;
        bool m_select_mode = false;
        bool m_scroll_to_target = false;
        const StyleVariableStore* m_variable_store = nullptr;
        std::vector<std::string> m_variable_names;
    };
} // namespace ui
