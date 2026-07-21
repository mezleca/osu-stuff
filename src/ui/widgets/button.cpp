#include "button.hpp"
#include "../ui.hpp"
#include "../theme.hpp"

UIButtonWidget::UIButtonWidget(std::string text, ImVec2 size) : UIWidget("button"), m_text(text), m_size(size) {

    UI& ui = ui::current();

    auto torus_semi = ui.get_font(TORUS_SEMI).get(16);

    state().set_for_all_styles([&](UIStyle& style) {
        style.font = torus_semi;
        style.color.set(ui_theme::TEXT_COLOR);
        style.background_color.set(ui_theme::BG_SECONDARY_COLOR);
        style.border_color.set(ui_theme::BG_SECONDARY_COLOR);
        style.border_color.speed = 12.0f;
        style.border_radius = 4.0f;
        style.border_thickness = 2.0f;
    });

    UIStyle& active_style = state().get_style(UIStyleType::ACTIVE);
    UIStyle& hover_style = state().get_style(UIStyleType::HOVER);

    active_style.border_color.set(ui_theme::ACCENT_COLOR);
    active_style.border_color.speed = 20.0f;
    hover_style.border_color.set(ui_theme::BORDER_COLOR);

    state().snap_to_style(UIStyleType::DEFAULT);
}

void UIButtonWidget::show() {
    const float dt = ImGui::GetIO().DeltaTime;
    const UIStyle& style = state().get_style();

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 16.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, style.border_radius);
    ImGui::PushStyleColor(ImGuiCol_Button, style.background_color.get());
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, style.background_color.get());
    ImGui::PushStyleColor(ImGuiCol_ButtonActive, style.background_color.get());
    ImGui::PushStyleColor(ImGuiCol_Text, style.color.get());
    ImGui::PushFont(style.font);

    auto dl = ImGui::GetWindowDrawList();

    const bool is_pressed = ImGui::Button(m_text.c_str());
    const bool is_hovered = ImGui::IsItemHovered();
    const bool is_active = ImGui::IsItemActive();

    ImGui::PopFont();
    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(4);

    if (on_click && ImGui::IsItemClicked(ImGuiMouseButton_Left)) {
        on_click();
    }

    if (is_pressed || is_active) {
        state().set_style(UIStyleType::ACTIVE);
    } else if (is_hovered) {
        state().set_style(UIStyleType::HOVER);
    } else {
        state().set_style(UIStyleType::DEFAULT);
    }

    state().update(dt);

    auto min = ImGui::GetItemRectMin();
    auto max = ImGui::GetItemRectMax();

    dl->AddRect(min, max, style.border_color.get_col(), style.border_radius, style.border_thickness);
}
