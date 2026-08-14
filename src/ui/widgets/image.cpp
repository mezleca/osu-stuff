#include "image.hpp"

#include "../theme.hpp"
#include "../texture/icon.hpp"

UIImageWidget::UIImageWidget(IconTexture* texture) : UIWidget("image"), m_texture(texture) {
    state().set_for_all_styles([&](UIStyle& style) { style.color.set(ui_theme::TEXT_COLOR); });
    state().snap_to_style(UIStyleType::DEFAULT);
}

void UIImageWidget::show() {
    if (!state().is_visible()) {
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;

    if (m_texture == nullptr) {
        ImGui::Dummy(m_size);
        state().update(dt);
        return;
    }

    const UIStyle& style = state().get_style();
    const GLuint texture_id = m_texture->get(m_size);

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());

    ImGui::ImageWithBg(
        static_cast<ImTextureID>(texture_id), m_size, {0, 0}, {1, 1}, ImColor(0, 0, 0, 0), style.color.get_col()
    );

    ImGui::PopStyleVar(1);

    state().update(dt);
}
