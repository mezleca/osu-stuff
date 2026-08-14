#include "tab-button.hpp"
#include "../theme.hpp"
#include "../../../ui/ui.hpp"

static constexpr float LINE_ALPHA_SPEED = 18.0f;
static constexpr float WIDTH_SPEED = 14.0f;

TabButtonWidget::TabButtonWidget(std::string name, bool line, bool title)
    : ui::Widget("tab-button"), m_name(name), m_draw_line(line) {
    state().set_for_all_styles([&](ui::Style& style) {
        style.color.value = title ? app_theme::ACCENT_COLOR : app_theme::TEXT_COLOR;
        style.color.speed = 14.0f;
    });

    ui::Style& active_style = state().get_style(ui::StyleType::ACTIVE);

    if (line) {
        auto set_var_float_for_style = [this](ui::StyleType type, const std::string& key, float value, float speed) {
            ui::Style& style = state().get_style(type);
            ui::FloatValue val;
            val.value = value;
            val.speed = speed;
            style.variables().set(key, val);
        };

        set_var_float_for_style(ui::StyleType::DEFAULT, "line_alpha", 0.0f, LINE_ALPHA_SPEED);
        set_var_float_for_style(ui::StyleType::DEFAULT, "line_width", 0.0f, WIDTH_SPEED);
        set_var_float_for_style(ui::StyleType::HOVER, "line_alpha", app_theme::HOVER_LINE_ALPHA, LINE_ALPHA_SPEED);
        set_var_float_for_style(ui::StyleType::HOVER, "line_width", 1.0f, WIDTH_SPEED);
        set_var_float_for_style(ui::StyleType::ACTIVE, "line_alpha", 1.0f, LINE_ALPHA_SPEED);
        set_var_float_for_style(ui::StyleType::ACTIVE, "line_width", 1.0f, WIDTH_SPEED);
    }

    active_style.color.value = app_theme::ACCENT_COLOR;

    state().snap_to_style(ui::StyleType::DEFAULT);
}

void TabButtonWidget::on_draw() {
    if (!state().is_visible()) {
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const ui::Style& style = state().get_style();

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 6.0f});
    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_Text, style.color.get());

    const bool debugger_mode = ui::current().input_router().debug_select_mode();
    const bool pressed = ImGui::Button(m_name.c_str());
    const bool is_pressed = !debugger_mode && pressed;
    const bool is_hovered = !debugger_mode && ImGui::IsItemHovered();

    const bool handled = state().accepts_input() && ui::current().input_router().dispatch_last_item(*this);
    static_cast<void>(handled);

    if (m_draw_line) {
        const ui::FloatValue* line_alpha = style.variables().get<ui::FloatValue>("line_alpha");
        const ui::FloatValue* line_width_t = style.variables().get<ui::FloatValue>("line_width");

        if (line_alpha != nullptr && line_width_t != nullptr && line_alpha->value > 0.0f) {
            const ImVec2 rect_min = ImGui::GetItemRectMin();
            const ImVec2 rect_max = ImGui::GetItemRectMax();
            const float full_width = rect_max.x - rect_min.x;
            const float line_width = full_width * math_utils::smoothstep(line_width_t->value);
            const ImVec2 line_position = {
                rect_min.x + ((full_width - line_width) * 0.5f), rect_max.y + app_theme::LINE_OFFSET
            };
            ImVec4 line_color = app_theme::ACCENT_COLOR;
            line_color.w *= line_alpha->value;

            ImGui::GetWindowDrawList()->AddRectFilled(
                line_position, {line_position.x + line_width, line_position.y + app_theme::LINE_HEIGHT},
                ImGui::ColorConvertFloat4ToU32(line_color)
            );
        }
    }

    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(4);

    if (is_pressed || m_selected) {
        state().set_style(ui::StyleType::ACTIVE);
    } else if (is_hovered) {
        state().set_style(ui::StyleType::HOVER);
    } else {
        state().set_style(ui::StyleType::DEFAULT);
    }

    state().update(dt);
}
