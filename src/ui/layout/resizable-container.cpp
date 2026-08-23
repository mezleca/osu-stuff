#include "resizable-container.hpp"

#include "../imgui/draw.hpp"

#include <algorithm>

namespace ui {
    static constexpr float MIN_CHILD_SIZE = 32.0F;
    static constexpr float CHILD_RESIZE_HANDLE_SIZE = 20.0F;

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

        const ImVec2 max = ImGui::GetItemRectMax();
        const ImVec2 handle_min = {max.x - CHILD_RESIZE_HANDLE_SIZE, max.y - CHILD_RESIZE_HANDLE_SIZE};

        if (m_dragging) {
            if (ImGui::IsMouseDown(ImGuiMouseButton_Left)) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeAll);
                const ImVec2 mouse_pos = ImGui::GetMousePos();
                ImVec2 size = layout().size();
                const ImVec2 child_min = ImGui::GetItemRectMin();
                const ImVec2 parent_window_pos = ImGui::GetWindowPos();
                const ImVec2 parent_content_region_max = ImGui::GetWindowContentRegionMax();
                // clamp against the immediate parent content rectangle rather
                // than the root viewport, which may be substantially larger.
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
            m_resizing = ResizeAxes::None;
            return;
        }

        const bool is_hovering_handle = ImGui::IsMouseHoveringRect(handle_min, max);
        if (is_hovering_handle && ImGui::IsMouseClicked(ImGuiMouseButton_Left)) {
            m_dragging = true;
            m_drag_start = ImGui::GetMousePos();
            m_previous_size = layout().size();
            m_resizing = m_resize;
        }

        if (!is_hovering_handle) {
            return;
        }

        if ((m_resize & ResizeAxes::X) != ResizeAxes::None && (m_resize & ResizeAxes::Y) != ResizeAxes::None) {
            ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNWSE);
        } else if ((m_resize & ResizeAxes::X) != ResizeAxes::None) {
            ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeEW);
        } else if ((m_resize & ResizeAxes::Y) != ResizeAxes::None) {
            ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNS);
        }
    }

    void ResizableContainer::draw_resize_indicator() {
        if (m_resize == ResizeAxes::None) {
            return;
        }

        const float border_thickness = style().border_thickness();
        const ImU32 border_color = style().border_color().get_col();
        const ImVec2 max = ImGui::GetItemRectMax();

        for (int i = 0; i < 3; ++i) {
            const float distance = 3.0F + static_cast<float>(i) * 4.0F;
            draw_line({max.x - distance, max.y}, {max.x, max.y - distance}, border_color, border_thickness);
            draw_line(
                {max.x - distance + border_thickness + 0.5f, max.y},
                {max.x, max.y - distance + border_thickness + 0.5f}, ImColor(20.0F, 20.0F, 20.0F, 255.0F),
                border_thickness
            );
        }
    }
} // namespace ui
