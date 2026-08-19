#include "text.hpp"

#include <imgui.h>

namespace ui {
    void TextWidget::set_wrap(float wrap) {
        m_wrap = wrap;
        m_text->set_wrap(wrap);
    }

    void TextWidget::update_layout_size() {
        m_text->set_font(font());
        layout().set_size(m_text->text_size());
    }

    void TextWidget::on_layout() {
        update_layout_size();
    }

    bool TextWidget::on_draw() {
        ImFont* text_font = font();

        if (text_font != nullptr) ImGui::PushFont(text_font);
        if (m_wrap >= 0.0F) ImGui::PushTextWrapPos(m_wrap);

        ImGui::TextUnformatted(m_text->c_str());

        if (m_wrap >= 0.0F) ImGui::PopTextWrapPos();
        if (text_font != nullptr) ImGui::PopFont();

        return true;
    }

    std::optional<std::string> TextWidget::get_content() const {
        return m_text->str();
    }

    bool TextWidget::set_content(std::string content) {
        if (content == m_text->str()) {
            return false;
        }

        m_text->set(std::move(content));
        return true;
    }

} // namespace ui
