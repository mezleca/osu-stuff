#pragma once

#include <ui/style/theme.hpp>

constexpr float HEADER_TABS_GAP = 15.0f;
constexpr float LINE_HEIGHT = 2.0f;
constexpr float LINE_OFFSET = 1.0f;
constexpr float HOVER_LINE_ALPHA = 0.35f;

constexpr ImVec4 COLOR_RED = ImVec4(1.0f, 66.0f / 255.0f, 66.0f / 255.0f, 1.0f);
constexpr ImVec4 COLOR_BLUE = ImVec4(100.0f / 255.0f, 180.0f / 255.0f, 1.0f, 1.0f);
constexpr ImVec4 COLOR_YELLOW = ImVec4(1.0f, 1.0f, 95.0f / 255.0f, 1.0f);

inline ui::Theme make_theme() {
    ui::Theme theme{};
    theme.content_padding = 12.0F;
    theme.box_rounding = 4.0F;
    theme.controls.rounding = 4.0F;
    theme.checkbox_rounding = 2.0F;
    theme.controls.border_thickness = 1.0F;
    theme.controls.thumb_size = 12.0F;

    theme.accent_color = {233.0F / 255.0F, 30.0F / 255.0F, 115.0F / 255.0F, 1.0F};
    theme.accent_hover_color = {240.0F / 255.0F, 98.0F / 255.0F, 146.0F / 255.0F, 1.0F};
    theme.background_color = {30.0F / 255.0F, 30.0F / 255.0F, 30.0F / 255.0F, 1.0F};
    theme.background_secondary_color = {42.0F / 255.0F, 42.0F / 255.0F, 42.0F / 255.0F, 1.0F};
    theme.background_tertiary_color = {26.0F / 255.0F, 26.0F / 255.0F, 26.0F / 255.0F, 1.0F};
    theme.scrollbar_background_color = {0.0F, 0.0F, 0.0F, 0.0F};
    theme.header_background_color = {36.0F / 255.0F, 36.0F / 255.0F, 36.0F / 255.0F, 1.0F};
    theme.text_color = {247.0F / 255.0F, 250.0F / 255.0F, 251.0F / 252.0F, 1.0F};
    theme.text_secondary_color = {203.0F / 255.0F, 213.0F / 255.0F, 224.0F / 255.0F, 1.0F};
    theme.border_color = {51.0F / 255.0F, 51.0F / 255.0F, 51.0F / 255.0F, 1.0F};
    theme.header_border_color = {94.0F / 255.0F, 94.0F / 255.0F, 94.0F / 255.0F, 0.25F};
    theme.button_active_color = {233.0F / 255.0F, 30.0F / 255.0F, 115.0F / 255.0F, 0.28F};
    theme.controls.background_color = {24.0F / 255.0F, 24.0F / 255.0F, 24.0F / 255.0F, 1.0F};
    theme.controls.hover_color = {38.0F / 255.0F, 38.0F / 255.0F, 38.0F / 255.0F, 1.0F};
    theme.controls.active_color = {233.0F / 255.0F, 30.0F / 255.0F, 115.0F / 255.0F, 0.22F};
    theme.controls.border_color = {72.0F / 255.0F, 72.0F / 255.0F, 72.0F / 255.0F, 1.0F};
    theme.controls.mark_color = theme.accent_color;
    theme.transparent = {0.0F, 0.0F, 0.0F, 0.0F};
    return theme;
}
