#pragma once

#include "../widget.hpp"
#include "../../utils/math.hpp"

#include <string>
#include <imgui.h>
#include <format>

struct TabButtonWidget : WidgetState {
    std::string name = "";

    explicit TabButtonWidget(std::string_view name) : name(name) {
        configure_anim("alpha", 0.0f, 12.0f);
        configure_anim("hover", 0.0f, 10.0f);
        configure_anim("line", 0.0f, 14.0f);
    }
};

inline bool tab_button(TabButtonWidget& s, std::string_view label, bool selected, bool draw_line, bool is_title) {
    if (selected) {
        const float hover_t = s.get_anim("hover");
        const float line_t = s.get_anim("line");

        if (line_t < hover_t) {
            s.set_anim_value("line", hover_t);
        }
    }

    s.set_anim_target("alpha", s.visible ? 1.0f : 0.0f);
    s.set_anim_target("line", selected ? 1.0f : 0.0f);
    s.tick();

    if (s.is_hidden()) {
        return false;
    }

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, s.get_anim("alpha", 1.0f));
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 6.0f});
    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_Text, (selected || is_title) ? ui_theme::ACCENT_COLOR : ui_theme::TEXT_COLOR);

    const bool is_pressed = ImGui::Button(std::format("{}##tab", label).c_str());
    const bool is_hovered = ImGui::IsItemHovered();

    s.set_anim_target("hover", is_hovered ? 1.0f : 0.0f);

    if (draw_line && !is_title) {
        const float line_t = s.get_anim("line");
        const float hover_t = s.get_anim("hover");
        const float width_t = selected ? line_t : hover_t;
        const float visible_t = selected ? line_t : (hover_t * ui_theme::HOVER_LINE_ALPHA);

        if (visible_t > 0.0f) {
            const ImVec2 rect_min = ImGui::GetItemRectMin();
            const ImVec2 rect_max = ImGui::GetItemRectMax();
            const float full_width = rect_max.x - rect_min.x;
            const float line_width = full_width * smoothstep(width_t);
            const float line_x = rect_min.x + ((full_width - line_width) * 0.5f);
            const float line_y = rect_max.y + ui_theme::LINE_OFFSET;
            ImVec4 line_color = ui_theme::ACCENT_COLOR;
            line_color.w *= visible_t;

            ImGui::GetWindowDrawList()->AddRectFilled(ImVec2{line_x, line_y},
                                                      ImVec2{line_x + line_width, line_y + ui_theme::LINE_HEIGHT},
                                                      ImGui::ColorConvertFloat4ToU32(line_color));
        }
    }

    if (is_pressed) {
        ImGui::PopStyleVar(2);
        ImGui::PopStyleColor(4);
        return true;
    }

    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(4);

    return false;
}
