#include "search.hpp"
#include "../custom.hpp"
#include "../ui.hpp"

#include <imgui_stdlib.h>

static constexpr float ALPHA_ANIM_SPEED = 12.0f;

SearchInputState::SearchInputState() : WidgetState() {
    set_for_all_styles([](WidgetStyle& style) {
        UIWidgetColor icon_color;
        icon_color.value = {120, 120, 120, 255};
        icon_color.speed = ALPHA_ANIM_SPEED;
        style.border_color.speed = ALPHA_ANIM_SPEED * 2.0f;
        style.vars.set("icon_color", icon_color);
    });

    WidgetStyle& active_style = get_style(WidgetStyleType::ACTIVE);
    WidgetStyle& hover_style = get_style(WidgetStyleType::HOVER);

    hover_style.vars.get<UIWidgetColor>("icon_color").value().value = {150, 150, 150, 255};
    hover_style.border_color.value = ui_theme::ACCENT_COLOR;
    active_style.border_color.value = ui_theme::ACCENT_COLOR;

    snap_to_style(WidgetStyleType::DEFAULT);
}

SearchInputWidget::SearchInputWidget(UI* ui, IconTexture* icon)
    : UIWidget(ui, "search-input"), m_label("##{}-search-input") {
    m_label.set({static_cast<void*>(this)});

    if (icon) {
        m_icon = icon;
    } else {
        m_icon = m_ui->get_texture("default");
    }
}

void SearchInputWidget::show() {
    if (!m_state.is_visible()) {
        return;
    }

    const float icon_size = 18.0f;
    const float dt = ImGui::GetIO().DeltaTime;
    const WidgetStyle& style = m_state.get_style();

    ImVec2 size = m_state.m_size;
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();

        if (m_state.m_fit_width) {
            size.x = available.x;
        }

        // let imgui grow
        size.y = 0.0f;
    }

    auto window_flags = ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse;
    auto child_flags =
        ImGuiChildFlags_AlwaysUseWindowPadding | ImGuiChildFlags_AutoResizeX | ImGuiChildFlags_AutoResizeY;

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, ui_theme::BOX_ROUNDING);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 2.0f});
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    ImGui::BeginChild(m_label.c_str(), size, child_flags, window_flags);
    
    const ImVec2 available = ImGui::GetContentRegionAvail();
    const float frame_height = ImGui::GetFrameHeight();
    const float row_start_y = ImGui::GetCursorPosY();

    ImGui::SetCursorPosY(row_start_y + (available.y - icon_size) * 0.5f);
    custom_imgui::image(m_icon, {icon_size, icon_size}, style.vars.get<UIWidgetColor>("icon_color").value().value);

    ImGui::SameLine(0.0f, 10.0f);
    ImGui::SetCursorPosY(row_start_y + (available.y - frame_height) * 0.5f);

    ImGui::SetNextItemWidth(size.x);
    ImGui::InputText(m_label.c_str(), &m_state.m_value);

    const bool is_active = ImGui::IsItemActive();
    const bool is_hovered = ImGui::IsItemHovered();
    
    ImGui::EndChild();
    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(3);

    if (is_active) {
        m_state.set_style(WidgetStyleType::ACTIVE);
    } else if (is_hovered) {
        m_state.set_style(WidgetStyleType::HOVER);
    } else {
        m_state.set_style(WidgetStyleType::DEFAULT);
    }

    m_state.update(dt);

    const ImVec2 rect_min = ImGui::GetItemRectMin();
    const ImVec2 rect_max = ImGui::GetItemRectMax();

    auto* dl = ImGui::GetWindowDrawList();
    dl->AddRect(rect_min, rect_max, ImColor(style.border_color.value), ui_theme::BOX_ROUNDING, 0, 4.0f);
}
