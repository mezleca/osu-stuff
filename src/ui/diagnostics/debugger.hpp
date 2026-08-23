#pragma once

#include "../widgets/image.hpp"

#include <SDL3/SDL_events.h>
#include <imgui.h>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

class UI;

namespace ui {
    enum class FontType;

    class Debugger {
    public:
        explicit Debugger(UI& target);
        ~Debugger();

        Debugger(const Debugger&) = delete;
        Debugger& operator=(const Debugger&) = delete;

        void setup();
        void set_enabled(bool enabled);
        [[nodiscard]] bool process_sdl_event(const SDL_Event* event);
        void update(float dt);
        void draw_highlight();
        void render();

        void set_style(const ImGuiStyle& style);
        void set_font(FontType type, int size);
        void set_icon(IconTexture* icon);

        [[nodiscard]] bool ready() const;

    private:
        void shutdown();
        void render_toolbar();
        void render_node_list();
        void render_sections();
        void render_node_tree(Node& node, int depth, bool show_duration, Node*& selected_target, bool update_target);
        void render_properties();
        void render_node_properties();
        void render_layout_properties();
        void render_style_properties();
        void render_style_variables(Style& style);
        void render_profiling();
        bool handle_inspect_event(const SDL_Event& event, bool mouse_event, SDL_WindowID main_window_id);
        void refresh_highlight();
        void set_inspect_mode(bool enabled, bool wait_for_release = false);
        void set_target(Node* target);
        void remove_target();
        [[nodiscard]] bool should_restore_flow_position() const;

        UI& m_target;
        std::unique_ptr<UI> m_ui;
        ImFont* m_font = nullptr;
        Rect m_highlight{};
        bool m_highlight_valid = false;
        ImageWidget m_icon;
        Node* m_node_target = nullptr;
        Node* m_profiling_target = nullptr;
        Node* m_hover_target = nullptr;
        // removed nodes stay alive until shutdown because application widgets may retain raw child pointers.
        std::vector<std::unique_ptr<Node>> m_detached_nodes;
        std::vector<std::string> m_variable_names;
        uint64_t m_target_identity = 0;
        StyleType m_inspected_style = StyleType::DEFAULT;
        bool m_enabled = false;
        bool m_inspect_mode = false;
        bool m_target_was_flow_position = false;
        bool m_select_properties = false;
        bool m_scroll_to_target = false;
    };
} // namespace ui
