#include "checkbox.hpp"

#include "../style/theme.hpp"
#include "../ui.hpp"

#include <algorithm>

namespace ui {
    CheckboxWidget::CheckboxWidget(UI& ui, bool& value, std::string label, std::string id)
        : Widget(std::move(id), WidgetType::Checkbox), m_ui(ui), m_value(&value), m_label(std::move(label)),
          m_mark_color(ui.theme().control_mark_color) {
        set_font(ui.get_primary_font(16));

        const Theme& theme = m_ui.theme();
        configure_all_styles([&theme](Style& style) {
            style.color(theme.text_color)
                .background_color(theme.control_background_color, 18.0F)
                .border_color(theme.control_border_color, 18.0F)
                .padding({4.0F, 4.0F})
                .border(BORDER_ALL)
                .border_radius(theme.checkbox_rounding)
                .border_thickness(theme.control_border_thickness);
        });
        configure_style(StyleType::HOVER, [&theme](Style& style) {
            style.background_color(theme.control_hover_color).border_color(theme.accent_hover_color);
        });
        configure_style(StyleType::ACTIVE, [&theme](Style& style) {
            style.background_color(theme.control_active_color).border_color(theme.accent_color);
        });
    }

    CheckboxWidget& CheckboxWidget::set_label(std::string label) {
        m_label = std::move(label);
        return *this;
    }

    CheckboxWidget& CheckboxWidget::set_type(CheckboxType type) {
        m_type = type;
        return *this;
    }

    CheckboxWidget& CheckboxWidget::set_box_size(float size) {
        m_box_size = std::max(1.0F, size);
        return *this;
    }

    CheckboxWidget& CheckboxWidget::set_mark_color(ImColor color) {
        m_mark_color = color;
        return *this;
    }

    bool CheckboxWidget::changed() const {
        return m_changed;
    }

    bool CheckboxWidget::on_draw() {
        if (!visually_visible()) {
            return false;
        }

        const Style& current_style = style();
        ImFont* font = current_style.font();
        if (font == nullptr) {
            font = ImGui::GetFont();
        }

        ImGui::PushID(this);
        ImGui::PushFont(font);
        const float frame_padding_y = std::max(0.0F, (m_box_size - ImGui::GetFontSize()) * 0.5F);
        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {current_style.padding().x, frame_padding_y});
        ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, current_style.border_radius());
        ImGui::PushStyleVar(ImGuiStyleVar_FrameBorderSize, current_style.border_thickness());
        ImGui::PushStyleColor(ImGuiCol_Text, current_style.color().get_col());
        ImGui::PushStyleColor(ImGuiCol_FrameBg, current_style.background_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, current_style.background_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_FrameBgActive, current_style.background_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_CheckboxSelectedBg, current_style.background_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_Border, current_style.border_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_CheckMark, m_mark_color.Value);

        const char* label = m_label.empty() ? "##value" : m_label.c_str();
        if (m_type == CheckboxType::Radio) {
            m_changed = ImGui::RadioButton(label, *m_value);
            if (m_changed) {
                *m_value = true;
            }
        } else {
            m_changed = ImGui::Checkbox(label, m_value);
        }

        ImGui::PopStyleColor(7);
        ImGui::PopStyleVar(3);
        ImGui::PopFont();

        const ItemInputState input = m_ui.input().observe(*this);
        ImGui::PopID();

        apply_input_state(input);
        return true;
    }

    std::optional<std::string> CheckboxWidget::content() const {
        return *m_value ? "true" : "false";
    }

    bool CheckboxWidget::try_set_content(std::string content) {
        bool value = false;
        if (content == "true" || content == "1") {
            value = true;
        } else if (content != "false" && content != "0") {
            return false;
        }

        if (*m_value == value) {
            return false;
        }

        *m_value = value;
        return true;
    }
} // namespace ui
