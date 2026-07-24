#include "notification.hpp"
#include "base/text.hpp"
#include "../ui.hpp"
#include "../theme.hpp"
#include "../constants.hpp"

DefaultNotificationWidget::DefaultNotificationWidget(std::string text) : UINotification(), m_text(text) {
    UIStyle& hover_style = state().get_style(UIStyleType::HOVER);
    UIStyle& active_style = state().get_style(UIStyleType::ACTIVE);

    ImFont* torus_semi = ui::current().get_font(UIFonts::TORUS_SEMI).get(16);

    m_offset.speed = 20.0f;
    m_current_offset.speed = 20.0f;

    state().set_for_all_styles([torus_semi](UIStyle& style) {
        style.color.set(ui_theme::TEXT_COLOR);
        style.border_color.set(ui_theme::BORDER_COLOR);
        style.border_radius = 4.0f;
        style.border_thickness = 1.0f;
        style.border_color.speed = 20.0f;
        style.font = torus_semi;
    });

    active_style.border_color.set(ui_theme::ACCENT_COLOR);
    hover_style.border_color.set(ui_theme::ACCENT_COLOR);

    state().snap_to_style(UIStyleType::DEFAULT);
}

void DefaultNotificationWidget::show() {
    const float dt = ImGui::GetIO().DeltaTime;
    const UIStyle& style = state().get_style();

    const auto child_flags =
        ImGuiChildFlags_AlwaysUseWindowPadding | ImGuiChildFlags_AutoResizeX | ImGuiChildFlags_AutoResizeY;

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, style.border_radius);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {8.0f, 16.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleColor(ImGuiCol_Text, style.color.get());
    ImGui::PushStyleColor(ImGuiCol_ChildBg, ui_theme::BG_COLOR);

    ImGui::SetCursorPos(m_current_offset.value);

    ImGui::PushID(this);
    ImGui::BeginChild("##ui-notification", {0.0f, 0.0f}, child_flags, constants::WIDGET_WINDOW_FLAGS);
    ImGui::PushFont(style.font);
    ImGui::TextUnformatted(m_text.c_str());

    bool clicked = ImGui::IsWindowHovered() && ImGui::IsMouseClicked(ImGuiMouseButton_Left);

    ui::current().draw_child_rect(style.border_color.get_col(), style.border_radius, style.border_thickness);

    ImGui::PopFont();
    ImGui::EndChild();
    ImGui::PopID();

    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(2);

    if (ImGui::IsItemActive()) {
        state().set_style(UIStyleType::ACTIVE);
    } else if (ImGui::IsItemHovered()) {
        state().set_style(UIStyleType::HOVER);
    } else {
        state().set_style(UIStyleType::DEFAULT);
    }

    m_current_offset.tick(m_offset, dt);
    state().update(dt);

    ImGui::Dummy(ImGui::GetItemRectSize());
}
