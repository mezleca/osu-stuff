#include "text.hpp"

#include <imgui.h>

namespace ui {
    void TextWidget::on_draw() {
        ImGui::TextUnformatted(m_text.c_str());
    }

    std::optional<std::string> TextWidget::get_content() const {
        return m_text;
    }

    bool TextWidget::set_content(std::string content) {
        if (content == m_text) {
            return false;
        }

        m_text = std::move(content);
        return true;
    }

} // namespace ui
