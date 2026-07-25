#include "line.hpp"

void UILineWidget::show() {
    ImGui::GetWindowDrawList()->AddLine(m_start, m_end, m_color, m_thickness);
}
