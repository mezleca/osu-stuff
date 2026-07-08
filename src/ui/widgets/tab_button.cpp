#include "tab_button.hpp"
#include "../ui.hpp"

#include <format>

static constexpr float ALPHA_ANIM_SPEED = 12.0f;
static constexpr float TAB_TEXT_COLOR_ANIM_SPEED = 14.0f;
static constexpr float TAB_LINE_ANIM_SPEED = 14.0f;
static constexpr float TAB_LINE_ALPHA_ANIM_SPEED = 18.0f;

static TabButtonStyle get_tab_button_target_style(bool visible, bool hovered, bool selected, bool is_title) {
    TabButtonStyle style;

    style.m_text_color.set((selected || is_title) ? ui_theme::ACCENT_COLOR : ui_theme::TEXT_COLOR);

    if (!visible) {
        style.m_line_alpha.value = 0.0f;
        style.m_line_width.value = 0.0f;
        return style;
    }

    if (selected) {
        style.m_line_alpha.value = 1.0f;
        style.m_line_width.value = 1.0f;
        return style;
    }

    if (hovered) {
        style.m_line_alpha.value = ui_theme::HOVER_LINE_ALPHA;
        style.m_line_width.value = 1.0f;
        return style;
    }

    style.m_line_alpha.value = 0.0f;
    style.m_line_width.value = 0.0f;
    return style;
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
    if (m_state.is_hidden()) {
        return;
    }

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, m_state.alpha.value);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 6.0f});
    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_Text, m_state.m_style.m_text_color.value);

    const bool is_pressed = ImGui::Button(m_name.c_str());
    const bool is_hovered = ImGui::IsItemHovered();

    if (is_pressed && on_click) {
        on_click();
    }

    // tick button style
    {
        const float dt = ImGui::GetIO().DeltaTime;
        auto target = get_tab_button_target_style(m_state.visible, is_hovered, selected, m_state.m_is_title);

        m_state.tick(ALPHA_ANIM_SPEED, dt);

        m_state.m_style.m_line_width.tick(target.m_line_width.value, TAB_LINE_ANIM_SPEED, dt);
        m_state.m_style.m_line_alpha.tick(target.m_line_alpha.value, TAB_LINE_ALPHA_ANIM_SPEED, dt);
        m_state.m_style.m_text_color.tick(target.m_text_color.value, TAB_TEXT_COLOR_ANIM_SPEED, dt);
    }

    if (m_state.m_draw_line && !m_state.m_is_title) {
        const float line_alpha = m_state.m_style.m_line_alpha.value;
        const float line_width_t = m_state.m_style.m_line_width.value;

        if (line_alpha > 0.0f) {
            const ImVec2 rect_min = ImGui::GetItemRectMin();
            const ImVec2 rect_max = ImGui::GetItemRectMax();
            const float full_width = rect_max.x - rect_min.x;
            const float line_width = full_width * math_utils::smoothstep(line_width_t);
            const float line_x = rect_min.x + ((full_width - line_width) * 0.5f);
            const float line_y = rect_max.y + ui_theme::LINE_OFFSET;
            ImVec4 line_color = ui_theme::ACCENT_COLOR;
            line_color.w *= line_alpha;

            ImGui::GetWindowDrawList()->AddRectFilled(
                ImVec2{line_x, line_y}, ImVec2{line_x + line_width, line_y + ui_theme::LINE_HEIGHT},
                ImGui::ColorConvertFloat4ToU32(line_color)
            );
        }
    }

    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(4);
}
