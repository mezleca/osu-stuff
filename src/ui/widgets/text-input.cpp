#include "text-input.hpp"

#include "../ui.hpp"
#include "../resources/icon.hpp"
#include "../style/theme.hpp"

#include <algorithm>
#include <cfloat>
#include <imgui_stdlib.h>
#include <SDL3/SDL_keycode.h>

namespace ui {
    static constexpr ImVec2 INPUT_ICON_SIZE = {18.0F, 18.0F};
    static constexpr float INPUT_ICON_SPACING = 10.0F;

    TextInputWidget::TextInputWidget(UI& ui, std::string& value) : TextInputWidget(ui, value, {}) {}

    TextInputWidget::TextInputWidget(UI& ui, std::string& value, std::string label)
        : ChildContainer(label, WidgetType::TextInput), m_ui(ui), m_value(&value), m_label(std::move(label)) {
        set_accepts_focus(true);
        set_font(ui.get_font(FontType::SEMIBOLD).get(18));

        const Theme& theme = m_ui.theme();
        state().configure_all_styles([&theme](Style& style) {
            style.border_color(theme.border_color, 24.0F)
                .padding({12.0F, 14.0F})
                .background_color(theme.background_secondary_color)
                .border(BORDER_ALL)
                .border_radius(theme.box_rounding);
        });
        state().configure_style(StyleType::ACTIVE, [&theme](Style& style) { style.border_color(theme.accent_color); });
        state().configure_style(StyleType::HOVER, [&theme](Style& style) { style.border_color(theme.accent_color); });

        on_event = [this](UiEvent& event) {
            if (event.type != EventType::Cancel && !(event.type == EventType::KeyDown && event.key == SDLK_ESCAPE)) {
                return;
            }

            m_ui.input_router().clear_focus(*this);
            event.stop_propagation();
        };
    }

    TextInputWidget& TextInputWidget::set_icon(IconTexture* icon) {
        m_icon = icon;
        return *this;
    }

    TextInputWidget& TextInputWidget::set_fit_width(bool fit_width) {
        m_fit_width = fit_width;
        return *this;
    }

    void TextInputWidget::on_layout() {
        ImVec2 size = layout().size();
        const ImVec2 available = ImGui::GetContentRegionAvail();

        if (m_fit_width || size.x <= 0.0F) {
            size.x = std::max(0.0F, available.x);
        }

        if (size.y <= 0.0F) {
            size.y = ImGui::GetTextLineHeight() + style().padding().y * 2.0F;
        }

        layout().set_size(size);
    }

    void TextInputWidget::draw_children() {
        const float icon_width = m_icon == nullptr ? 0.0F : INPUT_ICON_SIZE.x + INPUT_ICON_SPACING;
        const ImVec2 input_position = ImGui::GetCursorPos();
        const ImVec2 input_screen_position = ImGui::GetCursorScreenPos();
        const float input_height = ImGui::GetTextLineHeight();

        ImGui::SetCursorPosX(input_position.x + icon_width);
        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0F, 0.0F});

        const ImVec4 transparent = m_ui.theme().transparent;
        ImGui::PushStyleColor(ImGuiCol_FrameBg, transparent);
        ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, transparent);
        ImGui::PushStyleColor(ImGuiCol_FrameBgActive, transparent);

        ImGui::SetNextItemWidth(-FLT_MIN);
        ImGui::InputText(m_label.empty() ? "##text-input" : m_label.c_str(), m_value);
        m_input_state = m_ui.input().observe(*this);
        m_input_state.hovered = m_input_state.hovered || ImGui::IsWindowHovered();

        ImGui::PopStyleColor(3);
        ImGui::PopStyleVar();

        if (m_icon == nullptr) {
            return;
        }

        const float icon_y = input_screen_position.y + (input_height - INPUT_ICON_SIZE.y) * 0.5F;
        const ImVec2 icon_min = {input_screen_position.x, icon_y};
        const ImVec2 icon_max = {icon_min.x + INPUT_ICON_SIZE.x, icon_min.y + INPUT_ICON_SIZE.y};
        const ImVec4 icon_color =
            m_input_state.hovered || m_input_state.active ? m_ui.theme().text_color : m_ui.theme().text_secondary_color;
        ImGui::GetWindowDrawList()->AddImage(
            static_cast<ImTextureID>(m_icon->get(INPUT_ICON_SIZE)), icon_min, icon_max, {0.0F, 0.0F}, {1.0F, 1.0F},
            ImColor(icon_color)
        );
    }

    void TextInputWidget::on_draw_end() {
        apply_input_state(m_input_state);
        ChildContainer::on_draw_end();
    }

    const ItemInputState& TextInputWidget::input_state() const {
        return m_input_state;
    }

    std::optional<std::string> TextInputWidget::get_content() const {
        return m_value == nullptr ? std::nullopt : std::optional<std::string>{*m_value};
    }

    bool TextInputWidget::set_content(std::string content) {
        if (m_value == nullptr || *m_value == content) {
            return false;
        }

        *m_value = std::move(content);
        return true;
    }
} // namespace ui
