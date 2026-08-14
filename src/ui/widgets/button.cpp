#include "button.hpp"
#include "../ui.hpp"
#include "../theme.hpp"

namespace ui {
    ButtonWidget::ButtonWidget(std::string text, ImVec2 size) : Widget("button"), m_text(text), m_size(size) {
        UI& ui = current();

        auto torus_semi = ui.get_font(FontType::SEMIBOLD).get(16);

        state().set_for_all_styles([&](Style& style) {
            style.font = torus_semi;
            style.color.set(ui_theme::TEXT_COLOR);
            style.background_color.set(ui_theme::BG_SECONDARY_COLOR);
            style.border_color.set(ui_theme::BG_SECONDARY_COLOR);
            style.border_color.speed = 12.0f;
            style.border_radius = 4.0f;
            style.border_thickness = 2.0f;
        });

        Style& active_style = state().get_style(StyleType::ACTIVE);
        Style& hover_style = state().get_style(StyleType::HOVER);

        active_style.border_color.set(ui_theme::ACCENT_COLOR);
        active_style.border_color.speed = 20.0f;
        hover_style.border_color.set(ui_theme::BORDER_COLOR);
    }

    std::optional<std::string> ButtonWidget::get_content() const {
        return m_text.str();
    }

    bool ButtonWidget::set_content(std::string content) {
        if (content == m_text.str()) {
            return false;
        }

        m_text.set(std::move(content));
        return true;
    }

    void ButtonWidget::on_draw() {
        if (!state().is_visible()) {
            return;
        }

        const float dt = ImGui::GetIO().DeltaTime;
        const Style& style = state().get_style();

        ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 16.0f});
        ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, style.border_radius);
        ImGui::PushStyleColor(ImGuiCol_Button, style.background_color.get());
        ImGui::PushStyleColor(ImGuiCol_ButtonHovered, style.background_color.get());
        ImGui::PushStyleColor(ImGuiCol_ButtonActive, style.background_color.get());
        ImGui::PushStyleColor(ImGuiCol_Text, style.color.get());
        ImGui::PushFont(style.font);

        const bool pressed = ImGui::Button(m_text.c_str());

        ImGui::PopFont();
        ImGui::PopStyleVar(3);
        ImGui::PopStyleColor(4);

        const LastItemState input =
            current().input_router().handle_last_item(*this, {.accepts_input = state().accepts_input()});
        state().set_item_state(input.hovered, input.active || pressed);

        state().update(dt);

        const auto min = ImGui::GetItemRectMin();
        const auto max = ImGui::GetItemRectMax();

        auto* dl = ImGui::GetWindowDrawList();
        dl->AddRect(min, max, style.border_color.get_col(), style.border_radius, style.border_thickness);
    }

} // namespace ui
