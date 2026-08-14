#pragma once

#include <imgui.h>

namespace constants {
    inline constexpr ImVec2 TEXTURE_SMALL = {16.0f, 16.0f};
    inline constexpr ImVec2 TEXTURE_MEDIUM = {18.0f, 18.0f};
    inline constexpr ImVec2 TEXTURE_BIG = {24.0f, 24.0f};
    inline constexpr ImVec2 TEXTURE_EXTRA_BIG = {32.0f, 32.0f};

    inline constexpr ImGuiWindowFlags WIDGET_WINDOW_FLAGS =
        ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollWithMouse;
}; // namespace constants
