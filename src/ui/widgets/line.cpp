#include "line.hpp"

namespace ui {
    void LineWidget::on_draw() {
        ImGui::GetWindowDrawList()->AddLine(m_start, m_end, m_color, m_thickness);
    }

} // namespace ui
