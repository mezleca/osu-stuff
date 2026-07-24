#include "notification.hpp"
#include "base/text.hpp"
#include "../ui.hpp"
#include "../theme.hpp"
#include "../constants.hpp"
#include "../managers/notification-manager.hpp"

#include <imgui_internal.h>

static constexpr ImVec2 CLOSE_ICON_SIZE = {16, 16};

static ImColor get_border_by_level(LogNotificationLevel level) {
    switch (level) {
        case LogNotificationLevel::INFO:
            return ui_theme::BLUE;
        case LogNotificationLevel::ERROR:
            return ui_theme::RED;
        case LogNotificationLevel::WARN:
            return ui_theme::YELLOW;
        case LogNotificationLevel::PLACEHOLDER:
            return ui_theme::ACCENT_COLOR;
    }

    return ui_theme::ACCENT_COLOR;
}

LogNotificationWidget::LogNotificationWidget(LogNotificationLevel level, std::string text)
    : UINotification(UINotificationType::LOG), m_text(text), m_level(level) {
    UIStyle& hover_style = state().get_style(UIStyleType::HOVER);
    UIStyle& active_style = state().get_style(UIStyleType::ACTIVE);

    auto* close_icon = ui::current().get_texture("x-icon");
    ImFont* torus_semi = ui::current().get_font(UIFonts::TORUS_SEMI).get(16);

    m_offset.speed = 20.0f;
    m_current_offset.speed = 20.0f;

    state().set_for_all_styles([torus_semi](UIStyle& style) {
        style.color.set(ui_theme::TEXT_COLOR);
        style.border_color.set(ui_theme::BORDER_COLOR);
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

    m_icon.state().set_for_all_styles([](UIStyle& style) { style.color.set(ui_theme::TEXT_SECONDARY_COLOR); });

    m_icon.state().snap_to_style(UIStyleType::DEFAULT);
    state().snap_to_style(UIStyleType::DEFAULT);
}

void LogNotificationWidget::close() {
    if (m_closing) {
        return;
    }

    m_closing = true;

    state().set_opacity(0.0f);
    m_icon.state().set_opacity(0.0f);
}

void LogNotificationWidget::show() {
    if (m_closing && !state().is_visible()) {
        (void)ui::current().notification_manager()->remove(this);
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const UIStyle& style = state().get_style();

    const auto child_flags =
        ImGuiChildFlags_AlwaysUseWindowPadding | ImGuiChildFlags_AutoResizeX | ImGuiChildFlags_AutoResizeY;

    bool clicked = false;
    bool close_clicked = false;

    const float opacity = state().get_opacity();

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, style.border_radius);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {8.0f, 16.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, opacity);
    ImGui::PushStyleColor(ImGuiCol_Text, style.color.get());
    ImGui::PushStyleColor(ImGuiCol_ChildBg, ui_theme::BG_COLOR);

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
            m_icon.show();

            close_clicked = ImGui::IsItemClicked();
        }

        clicked = ImGui::IsWindowHovered() && ImGui::IsMouseClicked(ImGuiMouseButton_Left);

        auto border_color = style.border_color.get_col().Value;
        border_color.w = opacity;

        ui::current().draw_child_rect(border_color, style.border_radius, style.border_thickness);
        ImGui::PopFont();
    }
    ImGui::EndChild();
    ImGui::PopID();

    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(2);

    if (!close_clicked && clicked && m_onclick) {
        m_onclick();
    }

    if (close_clicked && !m_closing) {
        if (m_onclose) {
            m_onclose();
        } else {
            close();
        }
    }

    if (ImGui::IsItemActive()) {
        state().set_style(UIStyleType::ACTIVE);
    } else if (ImGui::IsItemHovered()) {
        state().set_style(UIStyleType::HOVER);
    } else {
        state().set_style(UIStyleType::DEFAULT);
    }

    m_current_offset.tick(m_offset, dt);
    state().update(dt);

    ImGui::Dummy(ImGui::GetItemRectSize());
}
