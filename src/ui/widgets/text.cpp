#include "text.hpp"

#include <imgui.h>

void UITextWidget::show() {
    ImGui::TextUnformatted(m_text.c_str());
}
