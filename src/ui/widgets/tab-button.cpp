#include "tab-button.hpp"
#include "../theme.hpp"
#include "../ui.hpp"

static constexpr float TAB_LINE_ALPHA_SPEED = 18.0f;
static constexpr float TAB_WIDTH_SPEED = 14.0f;

TabButtonWidget::TabButtonWidget(std::string name, bool line, bool title)
    : UIWidget("tab-button"), m_name(name), m_draw_line(line) {
    state().set_for_all_styles([&](UIStyle& style) {
        style.color.value = title ? ui_theme::ACCENT_COLOR : ui_theme::TEXT_COLOR;
        style.color.speed = 14.0f;
    });

    UIStyle& active_style = state().get_style(UIStyleType::ACTIVE);

    if (line) {
        auto set_var_float_for_style = [this](UIStyleType type, const std::string& key, float value, float speed) {
            UIStyle& style = state().get_style(type);
            UIWidgetFloat val;
            val.value = value;
            val.speed = speed;
            style.variables().set(key, val);
        };

        set_var_float_for_style(UIStyleType::DEFAULT, "line_alpha", 0.0f, TAB_LINE_ALPHA_SPEED);
        set_var_float_for_style(UIStyleType::DEFAULT, "line_width", 0.0f, TAB_WIDTH_SPEED);
        set_var_float_for_style(UIStyleType::HOVER, "line_alpha", ui_theme::HOVER_LINE_ALPHA, TAB_LINE_ALPHA_SPEED);
        set_var_float_for_style(UIStyleType::HOVER, "line_width", 1.0f, TAB_WIDTH_SPEED);
        set_var_float_for_style(UIStyleType::ACTIVE, "line_alpha", 1.0f, TAB_LINE_ALPHA_SPEED);
        set_var_float_for_style(UIStyleType::ACTIVE, "line_width", 1.0f, TAB_WIDTH_SPEED);
    }

    active_style.color.value = ui_theme::ACCENT_COLOR;

    state().snap_to_style(UIStyleType::DEFAULT);
}

void TabButtonWidget::show() {
    if (!state().is_visible()) {
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const UIStyle& style = state().get_style();

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 6.0f});
    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_Text, style.color.get());

    const bool is_pressed = ImGui::Button(m_name.c_str());
    const bool is_hovered = ImGui::IsItemHovered();

    if (is_pressed && m_onclick) {
        m_onclick();
    }

    if (m_draw_line) {
        const UIWidgetFloat* line_alpha = style.variables().get<UIWidgetFloat>("line_alpha");
        const UIWidgetFloat* line_width_t = style.variables().get<UIWidgetFloat>("line_width");

        if (line_alpha != nullptr && line_width_t != nullptr && line_alpha->value > 0.0f) {
            const ImVec2 rect_min = ImGui::GetItemRectMin();
            const ImVec2 rect_max = ImGui::GetItemRectMax();
            const float full_width = rect_max.x - rect_min.x;
            const float line_width = full_width * math_utils::smoothstep(line_width_t->value);
            const float line_x = rect_min.x + ((full_width - line_width) * 0.5f);
            const float line_y = rect_max.y + ui_theme::LINE_OFFSET;
            ImVec4 line_color = ui_theme::ACCENT_COLOR;
            line_color.w *= line_alpha->value;

            ImGui::GetWindowDrawList()->AddRectFilled(
                ImVec2{line_x, line_y}, ImVec2{line_x + line_width, line_y + ui_theme::LINE_HEIGHT},
                ImGui::ColorConvertFloat4ToU32(line_color)
            );
        }
    }

    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(4);

    if (is_pressed || m_selected) {
        state().set_style(UIStyleType::ACTIVE);
    } else if (is_hovered) {
        state().set_style(UIStyleType::HOVER);
    } else {
        state().set_style(UIStyleType::DEFAULT);
    }

    state().update(dt);
}
