#pragma once

#include <imgui.h>

namespace app_theme {
    constexpr float HEADER_TABS_GAP = 15.0f;
    constexpr float LINE_HEIGHT = 2.0f;
    constexpr float LINE_OFFSET = 1.0f;
    constexpr float HOVER_LINE_ALPHA = 0.35f;

    constexpr ImVec4 RED = ImVec4(255.0f / 255.0f, 66.0f / 255.0f, 66.0f / 255.0f, 1.0f);
    constexpr ImVec4 BLUE = ImVec4(100.0f / 255.0f, 180.0f / 255.0f, 255.0f / 255.0f, 1.0f);
    constexpr ImVec4 YELLOW = ImVec4(255.0f / 255.0f, 255.0f / 255.0f, 95.0f / 255.0f, 1.0f);
} // namespace app_theme
