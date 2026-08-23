#include "draw.hpp"

namespace ui {
    void draw_line(ImVec2 start, ImVec2 end, ImU32 color, float thickness) {
        ImGui::GetWindowDrawList()->AddLine(start, end, color, thickness);
    }

    void draw_text(ImVec2 position, ImU32 color, std::string_view text) {
        ImGui::GetWindowDrawList()->AddText(position, color, text.data(), text.data() + text.size());
    }

    void draw_triangle(ImVec2 center, ImVec2 size, ImU32 color, TriangleDirection direction) {
        const ImVec2 half_size = {size.x * 0.5F, size.y * 0.5F};
        ImVec2 first;
        ImVec2 second;
        ImVec2 third;

        switch (direction) {
            case TriangleDirection::Up:
                first = {center.x - half_size.x, center.y + half_size.y};
                second = {center.x, center.y - half_size.y};
                third = {center.x + half_size.x, center.y + half_size.y};
                break;
            case TriangleDirection::Down:
                first = {center.x - half_size.x, center.y - half_size.y};
                second = {center.x + half_size.x, center.y - half_size.y};
                third = {center.x, center.y + half_size.y};
                break;
            case TriangleDirection::Left:
                first = {center.x + half_size.x, center.y - half_size.y};
                second = {center.x + half_size.x, center.y + half_size.y};
                third = {center.x - half_size.x, center.y};
                break;
            case TriangleDirection::Right:
                first = {center.x - half_size.x, center.y - half_size.y};
                second = {center.x - half_size.x, center.y + half_size.y};
                third = {center.x + half_size.x, center.y};
                break;
        }

        ImGui::GetWindowDrawList()->AddTriangleFilled(first, second, third, color);
    }

    void
    draw_frame(ImVec2 minimum, ImVec2 maximum, ImU32 background, ImU32 border, float rounding, float border_thickness) {
        ImDrawList& draw_list = *ImGui::GetWindowDrawList();

        draw_list.AddRectFilled(minimum, maximum, background, rounding);
        if (border_thickness <= 0.0F) {
            return;
        }

        const float inset = border_thickness * 0.5F;
        draw_list.AddRect(
            {minimum.x + inset, minimum.y + inset}, {maximum.x - inset, maximum.y - inset}, border, rounding,
            ImDrawFlags_RoundCornersAll, border_thickness
        );
    }
} // namespace ui
