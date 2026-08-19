#include "stack-container.hpp"

#include <algorithm>
#include <vector>

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

    void StackContainer::set_padding(ImVec2 padding) {
        m_padding = {std::max(0.0F, padding.x), std::max(0.0F, padding.y)};
    }

    const ImVec2& StackContainer::padding() const {
        return m_padding;
    }

    bool StackContainer::on_draw() {
        ImGui::SetNextWindowContentSize(m_content_size);
        return ChildContainer::on_draw();
    }

    void StackContainer::on_layout() {
        const ImVec2 container_size = resolve_layout_size(layout().size(), ImGui::GetContentRegionAvail());

        layout().set_size(container_size);

        std::vector<ImVec2> child_sizes;
        child_sizes.reserve(children().size());

        for (const auto& child : children()) {
            ImVec2 child_size = child->layout().size();
            const ImVec2 content_size = {
                std::max(0.0F, container_size.x - m_padding.x * 2.0F),
                std::max(0.0F, container_size.y - m_padding.y * 2.0F),
            };

            if (m_direction == StackDirection::Vertical && child_size.x <= 0.0F) {
                child_size.x = content_size.x;
            }

            if (m_direction == StackDirection::Horizontal && child_size.y <= 0.0F) {
                child_size.y = content_size.y;
            }

            child_sizes.push_back(child_size);
        }

        const std::vector<Rect> child_rects =
            resolve_stack_layout(Rect{{0.0F, 0.0F}, container_size}, child_sizes, m_direction, m_spacing, m_padding);

        m_content_size = container_size;

        for (size_t index = 0; index < children().size(); ++index) {
            NodeLayout& child_layout = children()[index]->layout();
            child_layout.set_size(child_sizes[index]);
            child_layout.set_anchor(Anchor::TopLeft);
            child_layout.set_origin(Origin::TopLeft);
            child_layout.set_offset(child_rects[index].min);
            m_content_size.x = std::max(m_content_size.x, child_rects[index].max.x + m_padding.x);
            m_content_size.y = std::max(m_content_size.y, child_rects[index].max.y + m_padding.y);
        }
    }
} // namespace ui
