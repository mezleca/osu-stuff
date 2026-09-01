#include "tab-button.hpp"
#include "../theme.hpp"
#include <ui/ui.hpp>
#include "utils/math.hpp"

using namespace app;

static constexpr float TAB_TRANSITION_DURATION = 0.3F;

TabButtonWidget::TabButtonWidget(UI& ui, std::string name, bool line, bool title)
    : ui::Widget({}, "TabButton"), m_name(name), m_ui(ui), m_draw_line(line), m_title(title) {

    if (line) {
        const auto set_float = [this](ui::StyleType type, const char* name, float value, float duration) {
            style(type).variables().set(name, ui::FloatValue{value, duration});
        };

        set_float(ui::StyleType::DEFAULT, "line_alpha", 0.0f, TAB_TRANSITION_DURATION);
        set_float(ui::StyleType::DEFAULT, "line_width", 0.0f, TAB_TRANSITION_DURATION);
        set_float(ui::StyleType::HOVER, "line_alpha", app::HOVER_LINE_ALPHA, TAB_TRANSITION_DURATION);
        set_float(ui::StyleType::HOVER, "line_width", 1.0f, TAB_TRANSITION_DURATION);
        set_float(ui::StyleType::ACTIVE, "line_alpha", 1.0f, TAB_TRANSITION_DURATION);
        set_float(ui::StyleType::ACTIVE, "line_width", 1.0f, TAB_TRANSITION_DURATION);
    }

    const ui::Theme& theme = m_ui.theme();

    configure_all_styles([this, &theme](ui::Style& style) {
        style.color(m_title ? theme.accent_color : theme.text_secondary_color, TAB_TRANSITION_DURATION)
            .background_color(theme.transparent)
            .padding({8.0F, 6.0F});
    });

    style(ui::StyleType::ACTIVE).color(theme.accent_color);
}

void TabButtonWidget::on_measure() {
    m_name.set_font(font());
    const ImVec2 text_size = m_name.text_size();
    set_size({text_size.x + 16.0F, text_size.y + 12.0F});
}

bool TabButtonWidget::paint() {
    const ui::Style& style = this->style();
    const bool pressed = ImGui::Button(m_name.c_str());

    if (m_draw_line) {
        const ui::FloatValue* line_alpha = style.variables().get<ui::FloatValue>("line_alpha");
        const ui::FloatValue* line_width_t = style.variables().get<ui::FloatValue>("line_width");

        if (line_alpha != nullptr && line_width_t != nullptr && line_alpha->value > 0.0f) {
            const ImVec2 rect_min = ImGui::GetItemRectMin();
            const ImVec2 rect_max = ImGui::GetItemRectMax();
            const float full_width = rect_max.x - rect_min.x;
            const float line_width = full_width * math_utils::smoothstep(line_width_t->value);
            const ImVec2 line_position = {rect_min.x + ((full_width - line_width) * 0.5f), rect_max.y + app::LINE_OFFSET};
            ImVec4 line_color = m_ui.theme().accent_color;
            line_color.w *= line_alpha->value;

            ImGui::GetWindowDrawList()->AddRectFilled(
                line_position, {line_position.x + line_width, line_position.y + app::LINE_HEIGHT},
                ImGui::ColorConvertFloat4ToU32(line_color)
            );
        }
    }

    if (pressed || m_selected) {
        set_visual_style(ui::StyleType::ACTIVE);
    }

    return true;
}
