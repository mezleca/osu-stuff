#include "notification.hpp"
#include "base/text.hpp"
#include "../ui.hpp"
#include "../theme.hpp"

DefaultNotificationWidget::DefaultNotificationWidget(std::string text) : UINotification(), m_text(text) {
    state().set_for_all_styles([&](UIStyle& style) {
        UIWidgetFloat offset = {};
        offset.value = 0.0f;
        offset.speed = 5.0f;

        style.set_variable("offset", offset);
    });

    state().snap_to_style(UIStyleType::DEFAULT);
}

void DefaultNotificationWidget::show() {
    const float dt = ImGui::GetIO().DeltaTime;
    const UIStyle& style = state().get_style();

    ImGui::PushStyleColor(ImGuiCol_ChildBg, ImColor(255, 0, 0, 255).Value);
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    ImGui::Begin(m_text.c_str());
    ImGui::TextUnformatted(m_text.c_str());
    ImGui::End();

    ImGui::PopStyleColor(4);

    state().update(dt);
}
