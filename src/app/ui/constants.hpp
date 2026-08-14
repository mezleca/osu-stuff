#pragma once

#include <imgui.h>

namespace ui_constants {
    inline constexpr ImGuiWindowFlags WINDOW_FLAGS = ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove |
                                                     ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoSavedSettings |
                                                     ImGuiWindowFlags_NoBringToFrontOnFocus;

    inline constexpr ImGuiWindowFlags NOTIFICATION_OVERLAY_FLAGS =
        ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollbar |
        ImGuiWindowFlags_NoScrollWithMouse | ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoInputs |
        ImGuiWindowFlags_NoSavedSettings | ImGuiWindowFlags_NoFocusOnAppearing | ImGuiWindowFlags_NoNav;
} // namespace ui_constants
