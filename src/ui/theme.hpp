#pragma once

#include <imgui.h>

namespace ui_theme {
    constexpr float DEFAULT_ANIM_SPEED = 10.0f;

    constexpr float HEADER_PADDING_X = 25.0f;
    constexpr float HEADER_PADDING_Y = 4.0f;
    constexpr float HEADER_TABS_GAP = 18.0f;
    constexpr float HEADER_RIGHT_WIDTH = 180.0f;
    constexpr float CONTENT_PADDING = 16.0f;

    constexpr float LINE_HEIGHT = 2.0f;
    constexpr float LINE_OFFSET = 1.0f;
    constexpr float HOVER_LINE_ALPHA = 0.35f;

    constexpr ImVec4 ACCENT_COLOR = ImVec4{233.0f / 255.0f, 30.0f / 255.0f, 115.0f / 255.0f, 1.0f};
    constexpr ImVec4 ACCENT_HOVER_COLOR = ImVec4{240.0f / 255.0f, 98.0f / 255.0f, 146.0f / 255.0f, 1.0f};
    constexpr ImVec4 BG_COLOR = ImVec4{18.0f / 255.0f, 18.0f / 255.0f, 18.0f / 255.0f, 1.0f};
    constexpr ImVec4 BG_PRIMARY_COLOR = ImVec4{30.0f / 255.0f, 30.0f / 255.0f, 30.0f / 255.0f, 1.0f};
    constexpr ImVec4 BG_SECONDARY_COLOR = ImVec4{42.0f / 255.0f, 42.0f / 255.0f, 42.0f / 255.0f, 1.0f};
    constexpr ImVec4 BG_TERTIARY_COLOR = ImVec4{26.0f / 255.0f, 26.0f / 255.0f, 26.0f / 255.0f, 1.0f};
    constexpr ImVec4 HEADER_BG_COLOR = ImVec4{36.0f / 255.0f, 36.0f / 255.0f, 36.0f / 255.0f, 1.0f};
    constexpr ImVec4 TEXT_COLOR = ImVec4{247.0f / 255.0f, 250.0f / 255.0f, 251.0f / 252.0f, 1.0f};
    constexpr ImVec4 TEXT_SECONDARY_COLOR = ImVec4{203.0f / 255.0f, 213.0f / 255.0f, 224.0f / 255.0f, 1.0f};
    constexpr ImVec4 BORDER_COLOR = ImVec4{51.0f / 255.0f, 51.0f / 255.0f, 51.0f / 255.0f, 1.0f};
    constexpr ImVec4 HEADER_BORDER_COLOR = ImVec4{94.0f / 255.0f, 94.0f / 255.0f, 94.0f / 255.0f, 0.25f};
    constexpr ImVec4 BUTTON_ACTIVE_COLOR = ImVec4{233.0f / 255.0f, 30.0f / 255.0f, 99.0f / 255.0f, 0.28f};
} // namespace ui_theme
