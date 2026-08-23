#include "line.hpp"

#include "../imgui/draw.hpp"

#include <algorithm>

namespace ui {
    LineWidget::LineWidget(ImVec2 start, ImVec2 end, ImColor color, float thickness)
        : StyledNode({}, WidgetType::Line), m_start(start), m_end(end) {
        configure_all_styles([color, thickness](Style& style) { style.color(color).border_thickness(thickness); });
    }

    bool LineWidget::on_draw() {
        const Style& current_style = style();
        const float half_thickness = current_style.border_thickness() * 0.5F;
        set_screen_rect({
            {std::min(m_start.x, m_end.x) - half_thickness, std::min(m_start.y, m_end.y) - half_thickness},
            {std::max(m_start.x, m_end.x) + half_thickness, std::max(m_start.y, m_end.y) + half_thickness},
        });
        draw_line(m_start, m_end, current_style.color().get_col(), current_style.border_thickness());
        return true;
    }

} // namespace ui
