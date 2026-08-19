#include "resizable-container.hpp"

#include <algorithm>

static constexpr float MIN_CHILD_SIZE = 32.0f;
static constexpr float CHILD_RESIZE_HANDLE_SIZE = 20.0f;

namespace ui {
    ResizableContainer::ResizableContainer(std::string id)
        : ChildContainer(std::move(id), WidgetType::ResizableContainer) {}

    void ResizableContainer::set_resize(ResizeAxes resize) {
        m_resize = resize;
    }

    ResizeAxes ResizableContainer::resize_axes() const {
        return m_resize;
    }

    void ResizableContainer::on_draw_end() {
        ChildContainer::on_draw_end();
        draw_resize_indicator();
        handle_resize();
    }

    void ResizableContainer::handle_resize() {
        if (m_resize == ResizeAxes::None) {
            return;
        }

        const bool is_mouse_down = ImGui::IsMouseDown(ImGuiMouseButton_Left);
        const ImVec2 max = ImGui::GetItemRectMax();
        const ImVec2 handle_min = {max.x - CHILD_RESIZE_HANDLE_SIZE, max.y - CHILD_RESIZE_HANDLE_SIZE};

        if (m_dragging) {
            if (is_mouse_down) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeAll);
                const ImVec2 mouse_pos = ImGui::GetMousePos();
                ImVec2 size = layout().size();
                const ImVec2 child_min = ImGui::GetItemRectMin();
                const ImVec2 parent_window_pos = ImGui::GetWindowPos();
                const ImVec2 parent_content_region_max = ImGui::GetWindowContentRegionMax();
                const ImVec2 parent_content_max = {
                    parent_window_pos.x + parent_content_region_max.x,
                    parent_window_pos.y + parent_content_region_max.y,
                };
                const ImVec2 max_size = {
                    std::max(MIN_CHILD_SIZE, parent_content_max.x - child_min.x),
                    std::max(MIN_CHILD_SIZE, parent_content_max.y - child_min.y),
                };

                if ((m_resizing & ResizeAxes::X) != ResizeAxes::None) {
                    size.x = std::clamp(m_previous_size.x + mouse_pos.x - m_drag_start.x, MIN_CHILD_SIZE, max_size.x);
                }

                if ((m_resizing & ResizeAxes::Y) != ResizeAxes::None) {
                    size.y = std::clamp(m_previous_size.y + mouse_pos.y - m_drag_start.y, MIN_CHILD_SIZE, max_size.y);
                }

                layout().set_size(size);
                return;
            }

            m_dragging = false;
            m_last_click_pos = {0.0f, 0.0f};
            m_drag_start = {0.0f, 0.0f};
            m_resizing = ResizeAxes::None;
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
            if ((m_resize & ResizeAxes::X) != ResizeAxes::None && (m_resize & ResizeAxes::Y) != ResizeAxes::None) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNWSE);
            } else if ((m_resize & ResizeAxes::X) != ResizeAxes::None) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeEW);
            } else if ((m_resize & ResizeAxes::Y) != ResizeAxes::None) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNS);
            }
        }
    }

    void ResizableContainer::draw_resize_indicator() {
        if (m_resize == ResizeAxes::None) {
            return;
        }

        const float border_thickness = style().border_thickness();
        const ImColor resize_out_color = ImColor(20, 20, 20, 255);
        const ImColor border_color = style().border_color().get_col();
        const ImVec2 max = ImGui::GetItemRectMax();

        for (int i = 0; i < 3; ++i) {
            const float distance = 3.0F + static_cast<float>(i) * 4.0F;
            ImDrawList* draw_list = ImGui::GetWindowDrawList();
            draw_list->AddLine({max.x - distance, max.y}, {max.x, max.y - distance}, border_color, border_thickness);
            draw_list->AddLine(
                {max.x - distance + border_thickness + 0.5f, max.y},
                {max.x, max.y - distance + border_thickness + 0.5f}, resize_out_color, border_thickness
            );
        }
    }
} // namespace ui
