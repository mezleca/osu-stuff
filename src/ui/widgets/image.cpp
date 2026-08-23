#include "image.hpp"

#include "../imgui/draw.hpp"
#include "../ui.hpp"
#include "../resources/icon.hpp"

namespace ui {
    static void draw_image_border(Rect rect, const Style& style) {
        const uint8_t border = style.border();
        if (border == BORDER_NONE) {
            return;
        }

        const ImU32 color = style.border_color().get_col();
        const float thickness = style.border_thickness();
        if ((border & BORDER_ALL) != 0) {
            ImGui::GetWindowDrawList()->AddRect(
                rect.min, rect.max, color, style.border_radius(), ImDrawFlags_RoundCornersAll, thickness
            );
            return;
        }

        if ((border & BORDER_TOP) != 0) draw_line(rect.min, {rect.max.x, rect.min.y}, color, thickness);
        if ((border & BORDER_BOTTOM) != 0) {
            draw_line({rect.min.x, rect.max.y}, rect.max, color, thickness);
        }
        if ((border & BORDER_LEFT) != 0) draw_line(rect.min, {rect.min.x, rect.max.y}, color, thickness);
        if ((border & BORDER_RIGHT) != 0) {
            draw_line({rect.max.x, rect.min.y}, rect.max, color, thickness);
        }
    }

    ImageWidget::ImageWidget(IconTexture* texture) : Widget({}, WidgetType::Image), m_texture(texture) {}

    bool ImageWidget::on_draw() {
        if (!state().is_visible()) {
            return false;
        }

        const Style& style = state().style();
        const ImVec2 outer_size = layout().size();
        const ImVec2 outer_min = ImGui::GetCursorScreenPos();
        const Rect outer = Rect::from_position_size(outer_min, outer_size);
        const ImVec2 padding = style.padding();
        const Rect content = {
            {outer.min.x + padding.x, outer.min.y + padding.y},
            {outer.max.x - padding.x, outer.max.y - padding.y},
        };

        ImGui::Dummy(outer_size);

        ImDrawList* draw_list = ImGui::GetWindowDrawList();
        draw_list->AddRectFilled(outer.min, outer.max, style.background_color().get_col(), style.border_radius());

        if (m_texture != nullptr && content.valid()) {
            const ImVec2 image_size = content.size();
            const GLuint texture_id = m_texture->get(image_size);
            draw_list->AddImageRounded(
                static_cast<ImTextureID>(texture_id), content.min, content.max, {0, 0}, {1, 1}, style.color().get_col(),
                style.border_radius(), ImDrawFlags_RoundCornersAll
            );
        }

        draw_image_border(outer, style);
        return true;
    }

} // namespace ui
