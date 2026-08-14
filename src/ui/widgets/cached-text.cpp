#include "cached-text.hpp"

namespace ui {
    CachedTextNode::CachedTextNode(std::string id, CachedText& text, ImFont* font)
        : Node(std::move(id)), m_text(text), m_font(font) {}

    void CachedTextNode::set_wrap(float wrap) {
        m_wrap = wrap;
        m_text.set_wrap(wrap);
    }

    void CachedTextNode::update_layout_size() {
        layout().set_size(m_text.text_size(m_font));
    }

    void CachedTextNode::on_layout() {
        update_layout_size();
    }

    void CachedTextNode::on_draw() {
        ImGui::PushFont(m_font);

        if (m_wrap >= 0.0F) {
            ImGui::PushTextWrapPos(m_wrap);
        }

        ImGui::TextUnformatted(m_text.c_str());

        if (m_wrap >= 0.0F) {
            ImGui::PopTextWrapPos();
        }

        ImGui::PopFont();
    }
} // namespace ui
