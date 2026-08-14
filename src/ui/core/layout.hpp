#pragma once

#include "../object.hpp"

#include <imgui.h>
#include <cstdint>
#include <string>

namespace ui {
    enum LayoutResize : uint8_t {
        LAYOUT_RESIZE_NONE,
        LAYOUT_RESIZE_X = 1 << 0,
        LAYOUT_RESIZE_Y = 1 << 1,
        LAYOUT_RESIZE_ALL = LAYOUT_RESIZE_X | LAYOUT_RESIZE_Y
    };

    class ChildLayout : public StyledNode {
    public:
        explicit ChildLayout(std::string id);

        void set_size(ImVec2 size);
        [[nodiscard]] const ImVec2& get_size() const;
        void set_anchor(Anchor anchor);
        void set_anchor_position(ImVec2 relative_position);
        void set_origin(Origin origin);
        void set_origin_position(ImVec2 relative_position);
        void set_offset(ImVec2 offset);
        void set_resize(LayoutResize resize);
        void on_draw() override;

    private:
        void on_layout() override;
        void handle_resize();
        void draw_borders();
        void on_draw_end() override;

        ImVec2 m_last_click_pos = {0.0f, 0.0f};
        ImVec2 m_drag_start = {0.0f, 0.0f};
        ImVec2 m_previous_size = {0.0f, 0.0f};
        bool m_dragging = false;
        LayoutResize m_resize = LAYOUT_RESIZE_NONE;
        LayoutResize m_resizing = LAYOUT_RESIZE_NONE;
        bool m_fit_width = false;
    };

} // namespace ui
