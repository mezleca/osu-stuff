#pragma once

#include <imgui.h>

namespace ui {
    struct Theme {
        float content_padding = 12.0F;
        float box_rounding = 4.0F;
        float control_rounding = 4.0F;
        float checkbox_rounding = 2.0F;
        float control_border_thickness = 1.0F;
        float control_thumb_size = 12.0F;

        ImVec4 accent_color = {233.0F / 255.0F, 30.0F / 255.0F, 115.0F / 255.0F, 1.0F};
        ImVec4 accent_hover_color = {240.0F / 255.0F, 98.0F / 255.0F, 146.0F / 255.0F, 1.0F};
        ImVec4 background_color = {30.0F / 255.0F, 30.0F / 255.0F, 30.0F / 255.0F, 1.0F};
        ImVec4 background_secondary_color = {42.0F / 255.0F, 42.0F / 255.0F, 42.0F / 255.0F, 1.0F};
        ImVec4 background_tertiary_color = {26.0F / 255.0F, 26.0F / 255.0F, 26.0F / 255.0F, 1.0F};
        ImVec4 header_background_color = {36.0F / 255.0F, 36.0F / 255.0F, 36.0F / 255.0F, 1.0F};
        ImVec4 text_color = {247.0F / 255.0F, 250.0F / 255.0F, 251.0F / 252.0F, 1.0F};
        ImVec4 text_secondary_color = {203.0F / 255.0F, 213.0F / 255.0F, 224.0F / 255.0F, 1.0F};
        ImVec4 border_color = {51.0F / 255.0F, 51.0F / 255.0F, 51.0F / 255.0F, 1.0F};
        ImVec4 header_border_color = {94.0F / 255.0F, 94.0F / 255.0F, 94.0F / 255.0F, 0.25F};
        ImVec4 button_active_color = {233.0F / 255.0F, 30.0F / 255.0F, 115.0F / 255.0F, 0.28F};
        ImVec4 control_background_color = {24.0F / 255.0F, 24.0F / 255.0F, 24.0F / 255.0F, 1.0F};
        ImVec4 control_hover_color = {38.0F / 255.0F, 38.0F / 255.0F, 38.0F / 255.0F, 1.0F};
        ImVec4 control_active_color = {233.0F / 255.0F, 30.0F / 255.0F, 115.0F / 255.0F, 0.22F};
        ImVec4 control_border_color = {72.0F / 255.0F, 72.0F / 255.0F, 72.0F / 255.0F, 1.0F};
        ImVec4 control_mark_color = accent_color;
        ImVec4 transparent = {0.0F, 0.0F, 0.0F, 0.0F};

        [[nodiscard]] static Theme defaults() {
            return {};
        }
    };

} // namespace ui
