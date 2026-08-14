#include "draw.hpp"

namespace ui {
    void draw_child_rect(ImColor border_color, float radius, float thickness) {
        const ImVec2 window_position = ImGui::GetWindowPos();
        const ImVec2 window_size = ImGui::GetWindowSize();
        auto* draw_list = ImGui::GetWindowDrawList();

        draw_list->AddRect(
            window_position, ImVec2{window_position.x + window_size.x, window_position.y + window_size.y}, border_color,
            radius, 0, thickness
        );
    }
} // namespace ui
