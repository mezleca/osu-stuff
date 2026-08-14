#include "layout.hpp"
#include "../theme.hpp"

#include <algorithm>
#include <imgui_internal.h>

namespace ui {
    static constexpr float MIN_CHILD_SIZE = 32.0f;
    static constexpr float CHILD_RESIZE_HANDLE_SIZE = 20.0f;
    static constexpr float RESIZE_INDICATOR_DISTANCE = 4.0f;

    ChildLayout::ChildLayout(std::string id) : StyledNode(std::move(id)) {}

    void ChildLayout::set_size(ImVec2 size) {
        m_fit_width = size.x <= 0.0F;
        layout().set_size(size);
    }

    const ImVec2& ChildLayout::get_size() const {
        return layout().size();
    }

    void ChildLayout::set_anchor(Anchor anchor) {
        layout().set_anchor(anchor);
    }

    void ChildLayout::set_anchor_position(ImVec2 relative_position) {
        layout().set_anchor_position(relative_position);
    }

    void ChildLayout::set_origin(Origin origin) {
        layout().set_origin(origin);
    }

    void ChildLayout::set_origin_position(ImVec2 relative_position) {
        layout().set_origin_position(relative_position);
    }

    void ChildLayout::set_offset(ImVec2 offset) {
        layout().set_offset(offset);
    }

    void ChildLayout::set_resize(LayoutResize resize) {
        m_resize = resize;
    }

    void ChildLayout::on_layout() {
        if (!m_fit_width) {
            return;
        }

        ImVec2 size = layout().size();
        size.x = ImGui::GetContentRegionAvail().x;
        layout().set_size(size);
    }

    void ChildLayout::on_draw() {
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});
        ImGui::BeginChild(
            id().c_str(), layout().size(), ImGuiChildFlags_AlwaysUseWindowPadding, ImGuiWindowFlags_NoBackground
        );
    }

    void ChildLayout::on_draw_end() {
        ImGui::EndChild();
        ImGui::PopStyleVar();

        handle_resize();
        draw_borders();
    }

    void ChildLayout::handle_resize() {
        if (m_resize == LAYOUT_RESIZE_NONE) {
            return;
        }

        const ImVec2 max = ImGui::GetItemRectMax();
        const bool is_mouse_down = ImGui::IsMouseDown(ImGuiMouseButton_Left);
        const ImVec2 handle_min = {max.x - CHILD_RESIZE_HANDLE_SIZE, max.y - CHILD_RESIZE_HANDLE_SIZE};

        if (m_dragging) {
            if (is_mouse_down) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeAll);
                const ImVec2 mouse_pos = ImGui::GetMousePos();
                ImVec2 size = layout().size();

                if (m_resizing & LAYOUT_RESIZE_X) {
                    size.x = std::clamp(
                        m_previous_size.x + mouse_pos.x - m_drag_start.x, MIN_CHILD_SIZE,
                        ImGui::GetCurrentWindow()->RootWindow->Size.x
                    );
                }
                if (m_resizing & LAYOUT_RESIZE_Y) {
                    size.y = std::clamp(
                        m_previous_size.y + mouse_pos.y - m_drag_start.y, MIN_CHILD_SIZE,
                        ImGui::GetCurrentWindow()->RootWindow->Size.y
                    );
                }
                layout().set_size(size);
                return;
            }

            m_dragging = false;
            m_last_click_pos = {0.0f, 0.0f};
            m_drag_start = {0.0f, 0.0f};
            m_resizing = LAYOUT_RESIZE_NONE;
            return;
        }

        if (is_mouse_down && m_last_click_pos.x == 0.0f && m_last_click_pos.y == 0.0f) {
            m_last_click_pos = ImGui::GetMousePos();
        } else if (!is_mouse_down) {
            m_last_click_pos = {0.0f, 0.0f};
        }

        const bool is_hovering_handle = ImGui::IsMouseHoveringRect(handle_min, max);
        const bool should_drag_handle = m_last_click_pos.x > handle_min.x && m_last_click_pos.x < max.x &&
                                        m_last_click_pos.y > handle_min.y && m_last_click_pos.y < max.y;

        if (is_mouse_down && should_drag_handle) {
            m_dragging = true;
            m_drag_start = ImGui::GetMousePos();
            m_previous_size = layout().size();
            m_resizing = m_resize;
        } else if (is_hovering_handle) {
            if ((m_resize & LAYOUT_RESIZE_X) && (m_resize & LAYOUT_RESIZE_Y)) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNWSE);
            } else if (m_resize & LAYOUT_RESIZE_X) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeEW);
            } else if (m_resize & LAYOUT_RESIZE_Y) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNS);
            }
        }
    }

    void ChildLayout::draw_borders() {
        const ImVec2 min = ImGui::GetItemRectMin();
        const ImVec2 max = ImGui::GetItemRectMax();

        ImDrawList* draw_list = ImGui::GetWindowDrawList();

        const auto border_color = style().border_color.get_col();
        const auto border_thickness = style().border_thickness;

        if (style().border != BORDER_NONE) {
            if (style().border & BORDER_ALL) {
                draw_list->AddRect(min, max, border_color, 0.0f, 0, border_thickness);
            } else {
                if (style().border & BORDER_TOP) {
                    draw_list->AddLine({min.x, min.y}, {max.x, min.y}, border_color, border_thickness);
                }
                if (style().border & BORDER_BOTTOM) {
                    draw_list->AddLine({min.x, max.y}, {max.x, max.y}, border_color, border_thickness);
                }
                if (style().border & BORDER_LEFT) {
                    draw_list->AddLine({min.x, min.y}, {min.x, max.y}, border_color, border_thickness);
                }
                if (style().border & BORDER_RIGHT) {
                    draw_list->AddLine({max.x, min.y}, {max.x, max.y}, border_color, border_thickness);
                }
            }
        }

        if (m_resize != LAYOUT_RESIZE_NONE) {
            const ImColor resize_out_color = ImColor(20, 20, 20, 255);

            for (int i = 0; i < 3; ++i) {
                const float distance = 3.0f + static_cast<float>(i) * RESIZE_INDICATOR_DISTANCE;

                draw_list->AddLine(
                    {max.x - distance, max.y}, {max.x, max.y - distance}, border_color, border_thickness
                );
                draw_list->AddLine(
                    {max.x - distance + border_thickness + 0.5f, max.y},
                    {max.x, max.y - distance + border_thickness + 0.5f}, resize_out_color, border_thickness
                );
            }
        }
    }

} // namespace ui
