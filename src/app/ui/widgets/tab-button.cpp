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
}

std::optional<std::string> TabButtonWidget::get_content() const {
    return m_name.str();
}

bool TabButtonWidget::set_content(std::string content) {
    if (content == m_name.str()) {
        return false;
    }

    m_name.set(std::move(content));
    return true;
}

void TabButtonWidget::on_draw() {
    if (!state().is_visible()) {
        return;
    }

    auto& router = ui::current().input_router();

    const float dt = ImGui::GetIO().DeltaTime;
    const ui::Style& style = state().get_style();

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 6.0f});
    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_Text, style.color.get());

    const bool pressed = ImGui::Button(m_name.c_str());

    const ui::LastItemState input = router.handle_last_item(*this, {.accepts_input = state().accepts_input()});

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

    if (pressed || m_selected) {
        state().set_style(ui::StyleType::ACTIVE);
    } else {
        state().set_item_state(input.hovered, input.active);
    }

    state().update(dt);
}
