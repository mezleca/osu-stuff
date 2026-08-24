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

    void draw_line(ImVec2 start, ImVec2 end, ImColor color, float thickness);
    void draw_text(ImVec2 position, ImColor color, std::string_view text);
    void
    draw_triangle(ImVec2 center, ImVec2 size, ImColor color, TriangleDirection direction = TriangleDirection::Down);

    void draw_frame(
        ImVec2 minimum, ImVec2 maximum, ImColor background, ImColor border, float rounding, float border_thickness
    );
} // namespace ui
