#include "notification.hpp"
#include "../app.hpp"
#include "../../../ui/widgets/base/text.hpp"
#include "../../../ui/ui.hpp"
#include "../../../ui/core/draw.hpp"
#include "../theme.hpp"
#include "../../../ui/constants.hpp"
#include "../managers/notifications.hpp"

#include <imgui_internal.h>

static constexpr ImVec2 CLOSE_ICON_SIZE = {16, 16};

static ImColor get_border_by_level(LogNotificationLevel level) {
    switch (level) {
        case LogNotificationLevel::INFO:
            return app_theme::BLUE;
        case LogNotificationLevel::ERROR:
            return app_theme::RED;
        case LogNotificationLevel::WARN:
            return app_theme::YELLOW;
        case LogNotificationLevel::PLACEHOLDER:
            return app_theme::ACCENT_COLOR;
    }

    return app_theme::ACCENT_COLOR;
}

LogNotificationWidget::LogNotificationWidget(LogNotificationLevel level, std::string text)
    : UINotification(UINotificationType::LOG), m_text(text), m_level(level) {
    ui::Style& hover_style = state().get_style(ui::StyleType::HOVER);
    ui::Style& active_style = state().get_style(ui::StyleType::ACTIVE);

    auto* close_icon = ui::current().get_texture("x-icon");
    ImFont* torus_semi = ui::current().get_font(ui::FontType::SEMIBOLD).get(16);

    m_offset.speed = 20.0f;
    m_current_offset.speed = 20.0f;

    state().set_for_all_styles([torus_semi](ui::Style& style) {
        style.color.set(app_theme::TEXT_COLOR);
        style.border_color.set(app_theme::BORDER_COLOR);
        style.border_radius = 4.0f;
        style.border_thickness = 1.0f;
        style.border_color.speed = 20.0f;
        style.font = torus_semi;
    });

    const ImColor border_color = get_border_by_level(m_level);

    active_style.border_color.set(border_color);
    hover_style.border_color.set(border_color);

    m_icon.set_texture(close_icon);
    m_icon.set_size(CLOSE_ICON_SIZE);

    m_icon.state().set_for_all_styles([](ui::Style& style) { style.color.set(app_theme::TEXT_SECONDARY_COLOR); });

    m_icon.on_event = [this](ui::UiEvent& event) {
        if (event.type != ui::EventType::Click) {
            return;
        }

        if (m_onclose) {
            m_onclose();
        } else {
            close();
        }
        event.mark_handled();
    };

    m_icon.state().snap_to_style(ui::StyleType::DEFAULT);
    state().snap_to_style(ui::StyleType::DEFAULT);
}

void LogNotificationWidget::close() {
    if (m_closing) {
        return;
    }

    m_closing = true;

    state().set_opacity(0.0f);
    m_icon.state().set_opacity(0.0f);
}

void LogNotificationWidget::on_draw() {
    if (m_closing && !state().is_visible()) {
        (void)app::current().notification_manager()->remove(this);
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const ui::Style& style = state().get_style();

    const auto child_flags =
        ImGuiChildFlags_AlwaysUseWindowPadding | ImGuiChildFlags_AutoResizeX | ImGuiChildFlags_AutoResizeY;

    const float opacity = state().get_opacity();

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, style.border_radius);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {8.0f, 16.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, opacity);
    ImGui::PushStyleColor(ImGuiCol_Text, style.color.get());
    ImGui::PushStyleColor(ImGuiCol_ChildBg, app_theme::BG_COLOR);

    ImGui::SetNextWindowSizeConstraints({48.0f, 48.0f}, {256.0f, 196.0f});
    ImGui::SetCursorPos(m_current_offset.value);

    ImGui::PushID(this);
    ImGui::BeginChild("##ui-notification", {0.0f, 0.0f}, child_flags, constants::WIDGET_WINDOW_FLAGS);
    {
        ImGui::PushFont(style.font);

        const float wrap_pos_x = 256.0f - CLOSE_ICON_SIZE.x - 8.0f;
        m_text.set_wrap(wrap_pos_x);

        const ImVec2 text_size = m_text.text_size();
        const float row_start_y = ImGui::GetCursorPosY();

        ImGui::PushTextWrapPos(wrap_pos_x);
        ImGui::TextUnformatted(m_text.c_str());
        ImGui::PopTextWrapPos();

        if (m_level != LogNotificationLevel::PLACEHOLDER) {
            ImGui::SameLine(0.0f, 5.0f);
            ImGui::SetCursorPosY(row_start_y + (text_size.y - CLOSE_ICON_SIZE.y) * 0.5f);
            m_icon.draw();

            const bool close_handled =
                state().accepts_input() && ui::current().input_router().dispatch_last_item(m_icon);
            static_cast<void>(close_handled);
        }

        auto border_color = style.border_color.get_col().Value;
        border_color.w = opacity;

        ui::draw_child_rect(border_color, style.border_radius, style.border_thickness);
        ImGui::PopFont();
    }
    ImGui::EndChild();
    ImGui::PopID();

    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(2);

    const bool registered = state().accepts_input() && ui::current().input_router().dispatch_last_item(*this);
    static_cast<void>(registered);

    const bool debugger_mode = ui::current().input_router().debug_select_mode();
    if (!debugger_mode && ImGui::IsItemActive()) {
        state().set_style(ui::StyleType::ACTIVE);
    } else if (!debugger_mode && ImGui::IsItemHovered()) {
        state().set_style(ui::StyleType::HOVER);
    } else {
        state().set_style(ui::StyleType::DEFAULT);
    }

    m_current_offset.tick(m_offset, dt);
    state().update(dt);

    ImGui::Dummy(ImGui::GetItemRectSize());
}
