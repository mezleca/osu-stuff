#include "stack-container.hpp"

#include <algorithm>

namespace ui {
    StackContainer::StackContainer(std::string id, StackDirection direction)
        : ChildContainer(std::move(id), WidgetType::StackContainer), m_direction(direction) {}

    void StackContainer::set_direction(StackDirection direction) {
        m_direction = direction;
    }

    StackDirection StackContainer::direction() const {
        return m_direction;
    }

    void StackContainer::set_spacing(float spacing) {
        m_spacing = std::max(0.0F, spacing);
    }

    float StackContainer::spacing() const {
        return m_spacing;
    }

    bool StackContainer::on_draw() {
        ImGui::SetNextWindowContentSize(m_content_size);
        return ChildContainer::on_draw();
    }

    void StackContainer::on_layout() {
        if (!size_was_resolved()) {
            resolve_size(resolve_layout_size(layout().desired_size(), ImGui::GetContentRegionAvail()));
        }

        arrange_children(layout().size());
    }

    void StackContainer::arrange_children(ImVec2 container_size) {
        const ImVec2 padding = style().padding();
        const ImVec2 content_size = {
            std::max(0.0F, container_size.x - padding.x * 2.0F),
            std::max(0.0F, container_size.y - padding.y * 2.0F),
        };
        ImVec2 cursor{};
        m_content_size = content_size;

        for (const auto& child : children()) {
            if (!child->visible()) {
                continue;
            }

            ImVec2 child_size = child->layout().desired_size();

            // only the cross axis stretches. the flow axis must preserve the
            // intrinsic size produced by the measure pass.
            if (m_direction == StackDirection::Vertical && child_size.x <= 0.0F) {
                child_size.x = content_size.x;
            }

            if (m_direction == StackDirection::Horizontal && child_size.y <= 0.0F) {
                child_size.y = content_size.y;
            }

            const Rect child_rect = Rect::from_position_size(cursor, child_size);
            // explicit top-left placement prevents imgui item widths and same-line
            // behavior from becoming a second, implicit layout system.
            arrange_child(*child, child_size, Anchor::TopLeft, Origin::TopLeft, cursor);
            m_content_size.x = std::max(m_content_size.x, child_rect.max.x);
            m_content_size.y = std::max(m_content_size.y, child_rect.max.y);

            if (m_direction == StackDirection::Horizontal) {
                cursor.x = child_rect.max.x + m_spacing;
            } else {
                cursor.y = child_rect.max.y + m_spacing;
            }
        }
    }
} // namespace ui
