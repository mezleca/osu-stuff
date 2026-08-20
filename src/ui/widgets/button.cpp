#include "button.hpp"
#include "../ui.hpp"
#include "../style/theme.hpp"

namespace ui {
    ButtonWidget::ButtonWidget(UI& ui, std::string text, ImVec2 size)
        : Widget({}, WidgetType::Button), m_ui(ui), m_text(text), m_size(size) {
        set_font(ui.get_font(FontType::SEMIBOLD).get(16));

        const ui::Theme& theme = m_ui.theme();
        state().configure_all_styles([&theme](Style& style) {
            style.color(theme.text_color)
                .background_color(theme.background_secondary_color)
                .border_color(theme.background_secondary_color, 12.0F)
                .padding({12.0F, 6.0F})
                .border_radius(4.0F)
                .border_thickness(2.0F);
        });

        state().configure_style(StyleType::ACTIVE, [&theme](Style& style) {
            style.border_color(theme.accent_color, 20.0F);
        });

        state().configure_style(StyleType::HOVER, [&theme](Style& style) { style.border_color(theme.border_color); });
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
        if (!state().is_visible()) {
            return false;
        }

        const Style& style = state().style();

        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, style.padding());
        ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, style.border_radius());
        ImGui::PushStyleColor(ImGuiCol_Button, style.background_color().get());
        ImGui::PushStyleColor(ImGuiCol_ButtonHovered, style.background_color().get());
        ImGui::PushStyleColor(ImGuiCol_ButtonActive, style.background_color().get());
        ImGui::PushStyleColor(ImGuiCol_Text, style.color().get());

        ImFont* font = style.font();
        ImGui::PushFont(font == nullptr ? ImGui::GetFont() : font);

        const bool pressed = ImGui::Button(m_text.c_str(), m_size);

        ImGui::PopFont();
        ImGui::PopStyleVar(2);
        ImGui::PopStyleColor(4);

        const ItemInputState input = m_ui.input().handle(*this);
        apply_input_state(input, pressed);

        const auto min = ImGui::GetItemRectMin();
        const auto max = ImGui::GetItemRectMax();

        auto* dl = ImGui::GetWindowDrawList();
        dl->AddRect(
            min, max, ImGui::GetColorU32(style.border_color().get()), style.border_radius(), ImDrawFlags_None,
            style.border_thickness()
        );
        return true;
    }

} // namespace ui
