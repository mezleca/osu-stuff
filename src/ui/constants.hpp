#pragma once

#include <imgui.h>

namespace constants {
#ifdef NDEBUG
    inline constexpr bool IS_DEBUG_BUILD = false;
#else
    inline constexpr bool IS_DEBUG_BUILD = true;
#endif

    inline constexpr ImGuiWindowFlags WINDOW_FLAGS = ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove |
                                                     ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoSavedSettings |
                                                     ImGuiWindowFlags_NoBringToFrontOnFocus;

    inline constexpr ImGuiWindowFlags WIDGET_WINDOW_FLAGS =
        ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollWithMouse;

    inline constexpr ImGuiWindowFlags NOTIFICATION_OVERLAY_FLAGS =
        ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollbar |
        ImGuiWindowFlags_NoScrollWithMouse | ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoInputs |
        ImGuiWindowFlags_NoSavedSettings | ImGuiWindowFlags_NoFocusOnAppearing | ImGuiWindowFlags_NoNav;

    inline constexpr float SCROLL_WHEEL_SCALE = 0.5F;
} // namespace constants
