#include "tab_button.hpp"
#include "../ui.hpp"

static constexpr float TAB_LINE_ALPHA_SPEED = 18.0f;
static constexpr float TAB_WIDTH_SPEED = 14.0f;

TabButtonState::TabButtonState() : WidgetState() {
    set_for_all_styles([&](WidgetStyle& style) {
        style.color.value = ui_theme::TEXT_COLOR;
        style.color.speed = 14.0f;
    });

    WidgetStyle& default_style = get_style(WidgetStyleType::DEFAULT);
    WidgetStyle& hover_style = get_style(WidgetStyleType::HOVER);
    WidgetStyle& active_style = get_style(WidgetStyleType::ACTIVE);

    auto set_var_float_for_style = [&](WidgetStyleType type, const std::string& key, float value, float speed) {
        WidgetStyle& style = get_style(type);
        UIWidgetFloat val;
        val.value = value;
        val.speed = speed;
        style.vars.set(key, val);
    };

    // line bullshit
    set_var_float_for_style(WidgetStyleType::DEFAULT, "line_alpha", 0.0f, TAB_LINE_ALPHA_SPEED);
    set_var_float_for_style(WidgetStyleType::DEFAULT, "line_width", 0.0f, TAB_WIDTH_SPEED);
    set_var_float_for_style(WidgetStyleType::HOVER, "line_alpha", ui_theme::HOVER_LINE_ALPHA, TAB_LINE_ALPHA_SPEED);
    set_var_float_for_style(WidgetStyleType::HOVER, "line_width", 1.0f, TAB_WIDTH_SPEED);
    set_var_float_for_style(WidgetStyleType::ACTIVE, "line_alpha", 1.0f, TAB_LINE_ALPHA_SPEED);
    set_var_float_for_style(WidgetStyleType::ACTIVE, "line_width", 1.0f, TAB_WIDTH_SPEED);

    active_style.color.value = ui_theme::ACCENT_COLOR;

    snap_to_style(WidgetStyleType::DEFAULT);
}

TabButtonWidget::TabButtonWidget(UI* ui, std::string name, bool is_title, IconTexture* icon)
    : UIWidget(ui, "tab-button"), m_name(name) {
    m_state.m_is_title = is_title;

    if (icon) {
        m_icon = icon;
    } else {
        m_icon = m_ui->get_texture("default");
    }
}

void TabButtonWidget::show(bool selected) {
    if (!m_state.is_visible()) {
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const WidgetStyle& style = m_state.get_style();

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, m_state.get_opacity());
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 6.0f});
    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_Text, style.color.value);

    const bool is_pressed = ImGui::Button(m_name.c_str());
    const bool is_hovered = ImGui::IsItemHovered();

    auto current_style_type = m_state.get_style_type();

    if (is_pressed && on_click) {
        on_click();
    }

    if (m_state.m_draw_line && !m_state.m_is_title) {
        auto line_alpha = style.vars.get<UIWidgetFloat>("line_alpha").value();
        auto line_width_t = style.vars.get<UIWidgetFloat>("line_width").value();

        if (line_alpha.value > 0.0f) {
            const ImVec2 rect_min = ImGui::GetItemRectMin();
            const ImVec2 rect_max = ImGui::GetItemRectMax();
            const float full_width = rect_max.x - rect_min.x;
            const float line_width = full_width * math_utils::smoothstep(line_width_t.value);
            const float line_x = rect_min.x + ((full_width - line_width) * 0.5f);
            const float line_y = rect_max.y + ui_theme::LINE_OFFSET;
            ImVec4 line_color = ui_theme::ACCENT_COLOR;
            line_color.w *= line_alpha.value;

            ImGui::GetWindowDrawList()->AddRectFilled(
                ImVec2{line_x, line_y}, ImVec2{line_x + line_width, line_y + ui_theme::LINE_HEIGHT},
                ImGui::ColorConvertFloat4ToU32(line_color)
            );
        }
    }

    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(4);

    if (is_pressed || selected) {
        m_state.set_style(WidgetStyleType::ACTIVE);
    } else if (is_hovered) {
        m_state.set_style(WidgetStyleType::HOVER);
    } else {
        m_state.set_style(WidgetStyleType::DEFAULT);
    }

    m_state.update(dt);
}
