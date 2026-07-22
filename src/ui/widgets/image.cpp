#include "image.hpp"

#include "../theme.hpp"
#include "../texture/icon.hpp"

UIImageWidget::UIImageWidget(IconTexture* texture) : UIWidget("image"), m_texture(texture) {
    state().set_for_all_styles([&](UIStyle& style) { style.color.set(ui_theme::TEXT_COLOR); });

    state().snap_to_style(UIStyleType::DEFAULT);
}

void UIImageWidget::show() {
    if (m_texture == nullptr) {
        ImGui::Dummy(m_size);
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const UIStyle& style = state().get_style();
    const GLuint texture_id = m_texture->get(static_cast<int>(m_size.x), static_cast<int>(m_size.y));

    ImGui::ImageWithBg(
        static_cast<ImTextureID>(texture_id), m_size, {0, 0}, {1, 1}, ImColor(0, 0, 0, 0), style.color.get_col()
    );

    state().update(dt);
}
