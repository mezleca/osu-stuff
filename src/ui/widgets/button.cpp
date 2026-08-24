#include "button.hpp"
#include "../ui.hpp"
#include "../style/theme.hpp"

namespace ui {
    ButtonWidget::ButtonWidget(UI& ui, std::string text, ImVec2 size)
        : Widget({}, WidgetType::Button), m_ui(ui), m_text(text), m_size(size) {
        set_font(ui.get_primary_font(16));

        const ui::Theme& theme = m_ui.theme();
        configure_all_styles([&theme](Style& style) {
            style.color(theme.text_color)
                .background_color(theme.background_secondary_color)
                .border_color(theme.background_secondary_color, 0.2F)
                .padding({12.0F, 6.0F})
                .border_radius(4.0F)
                .border_thickness(2.0F);
        });

        configure_style(StyleType::ACTIVE, [&theme](Style& style) { style.border_color(theme.accent_color, 0.2F); });

        configure_style(StyleType::HOVER, [&theme](Style& style) { style.border_color(theme.border_color); });
    }

    std::optional<std::string> ButtonWidget::content() const {
        return m_text.str();
    }

    bool ButtonWidget::try_set_content(std::string content) {
        if (content == m_text.str()) {
            return false;
        }

        m_text.set(std::move(content));
        return true;
    }

    bool ButtonWidget::on_draw() {
        if (!visually_visible()) {
            return false;
        }

        const Style& style = this->style();

        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, style.padding());
        ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, style.border_radius());
        ImGui::PushStyleColor(ImGuiCol_Button, style.background_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_ButtonHovered, style.background_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_ButtonActive, style.background_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_Text, style.color().get_col());

        ImFont* font = style.font();
        ImGui::PushFont(font == nullptr ? ImGui::GetFont() : font);

        const bool pressed = ImGui::Button(m_text.c_str(), m_size);

        ImGui::PopFont();
        ImGui::PopStyleVar(2);
        ImGui::PopStyleColor(4);

        const ItemInputState input = m_ui.input().observe(*this);
        apply_input_state(input, pressed);

        const auto min = ImGui::GetItemRectMin();
        const auto max = ImGui::GetItemRectMax();

        auto* dl = ImGui::GetWindowDrawList();
        dl->AddRect(
            min, max, style.border_color().get_col(), style.border_radius(), ImDrawFlags_None, style.border_thickness()
        );
        return true;
    }

} // namespace ui
