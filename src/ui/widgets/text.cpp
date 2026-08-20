#include "text.hpp"

#include <imgui.h>

namespace ui {
    void TextWidget::set_wrap(float wrap) {
        if (m_wrap == wrap) {
            return;
        }

        m_wrap = wrap;
        m_text->set_wrap(wrap);
        invalidate_measure();
    }

    void TextWidget::update_layout_size() {
        m_text->set_font(font());
        layout().set_size(m_text->text_size());
    }

    void TextWidget::on_measure() {
        update_layout_size();
    }

    bool TextWidget::on_draw() {
        ImFont* text_font = font();
        if (text_font != nullptr) ImGui::PushFont(text_font);
        if (m_wrap >= 0.0F) ImGui::PushTextWrapPos(m_wrap);
        ImGui::PushStyleColor(ImGuiCol_Text, style().color().get());

        ImGui::TextUnformatted(m_text->c_str());

        ImGui::PopStyleColor();
        if (m_wrap >= 0.0F) ImGui::PopTextWrapPos();
        if (text_font != nullptr) ImGui::PopFont();

        return true;
    }

    std::optional<std::string> TextWidget::content() const {
        return m_text->str();
    }

    bool TextWidget::try_set_content(std::string content) {
        if (content == m_text->str()) {
            return false;
        }

        m_text->set(std::move(content));
        invalidate_measure();
        return true;
    }

} // namespace ui
