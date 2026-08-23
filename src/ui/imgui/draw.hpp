#pragma once

#include <imgui.h>
#include <string_view>

namespace ui {
    enum class TriangleDirection {
        Up,
        Down,
        Left,
        Right,
    };

    void draw_line(ImVec2 start, ImVec2 end, ImU32 color, float thickness);
    void draw_text(ImVec2 position, ImU32 color, std::string_view text);
    void draw_triangle(ImVec2 center, ImVec2 size, ImU32 color, TriangleDirection direction = TriangleDirection::Down);

    void
    draw_frame(ImVec2 minimum, ImVec2 maximum, ImU32 background, ImU32 border, float rounding, float border_thickness);
} // namespace ui
