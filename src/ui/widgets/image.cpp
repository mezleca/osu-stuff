#include "image.hpp"

#include "../ui.hpp"
#include "../resources/textures/icon.hpp"

namespace ui {
    ImageWidget::ImageWidget(IconTexture* texture) : Widget({}, WidgetType::Image), m_texture(texture) {}

    bool ImageWidget::on_draw() {
        if (!state().is_visible()) {
            return false;
        }

        const float dt = ImGui::GetIO().DeltaTime;
        const ImVec2& image_size = layout().size();

        if (m_texture == nullptr) {
            ImGui::Dummy(image_size);
            state().update(dt);
            return true;
        }

        const Style& style = state().style();
        const GLuint texture_id = m_texture->get(image_size);

        ImGui::ImageWithBg(
            static_cast<ImTextureID>(texture_id), image_size, {0, 0}, {1, 1}, ImColor(0, 0, 0, 0),
            style.color().get_col()
        );

        state().update(dt);
        return true;
    }

} // namespace ui
