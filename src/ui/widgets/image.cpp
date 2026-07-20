#include "image.hpp"

#include "../texture/icon.hpp"

void UIImageWidget::show() {
    if (m_texture == nullptr) {
        ImGui::Dummy(m_size);
        return;
    }

    const GLuint texture_id = m_texture->get(static_cast<int>(m_size.x), static_cast<int>(m_size.y));
    ImGui::ImageWithBg(static_cast<ImTextureID>(texture_id), m_size, {0, 0}, {1, 1}, ImColor(0, 0, 0, 0), m_color);
}
