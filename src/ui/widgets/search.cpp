#include "search.hpp"
#include "../ui.hpp"
#include "../theme.hpp"

#include <imgui_stdlib.h>

static constexpr float ALPHA_ANIM_SPEED = 12.0f;
static constexpr ImVec2 ICON_SIZE = {18.0f, 18.0f};

SearchInputWidget::SearchInputWidget(std::string& value)
    : UIWidget("search-input"), m_label("##{}-search-input"), m_value(&value), m_icon() {

    auto search_icon = ui::current().get_texture("search-icon");

    state().set_for_all_styles([](UIStyle& style) { style.border_color.speed = ALPHA_ANIM_SPEED * 2.0f; });

    UIStyle& active_style = state().get_style(UIStyleType::ACTIVE);
    UIStyle& hover_style = state().get_style(UIStyleType::HOVER);

    hover_style.border_color.value = ui_theme::ACCENT_COLOR;
    active_style.border_color.value = ui_theme::ACCENT_COLOR;

    m_label.set({static_cast<void*>(this)});

    m_icon.set_texture(search_icon);
    m_icon.set_size(ICON_SIZE);

    m_icon.state().set_for_all_styles([](UIStyle& style) {
        style.color.set({120, 120, 120, 255});
        style.color.speed = ALPHA_ANIM_SPEED;
    });

    UIStyle& icon_hover_style = m_icon.state().get_style(UIStyleType::HOVER);
    UIStyle& icon_active_style = m_icon.state().get_style(UIStyleType::ACTIVE);

    icon_hover_style.color.set({200, 200, 200, 255});
    icon_active_style.color.set({200, 200, 200, 255});

    state().snap_to_style(UIStyleType::DEFAULT);
    m_icon.state().snap_to_style(UIStyleType::DEFAULT);
}

void SearchInputWidget::set_fit_width(bool value) {
    m_fit_width = value;
}

void SearchInputWidget::show() {
    if (!state().is_visible()) {
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const UIStyle& style = state().get_style();

    ImVec2 size = m_size;
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();

        if (m_fit_width) {
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
    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    ImGui::BeginChild(m_label.c_str(), size, child_flags, window_flags);

    const ImVec2 available = ImGui::GetContentRegionAvail();
    const float frame_height = ImGui::GetFrameHeight();
    const float row_start_y = ImGui::GetCursorPosY();

    ImGui::SetCursorPosY(row_start_y + (available.y - m_icon.get_size().y) * 0.5f);

    m_icon.show();

    ImGui::SameLine(0.0f, 10.0f);
    ImGui::SetCursorPosY(row_start_y + (available.y - frame_height) * 0.5f);

    ImGui::SetNextItemWidth(size.x);
    ImGui::InputText(m_label.c_str(), m_value);

    const bool is_active = ImGui::IsItemActive();
    const bool is_hovered = ImGui::IsItemHovered();

    ui::current().draw_child_rect(style.border_color.get_col(), style.border_radius, style.border_thickness);

    ImGui::EndChild();
    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(3);

    if (is_active) {
        state().set_style(UIStyleType::ACTIVE);
        m_icon.state().set_style(UIStyleType::ACTIVE);
    } else if (is_hovered) {
        state().set_style(UIStyleType::HOVER);
        m_icon.state().set_style(UIStyleType::HOVER);
    } else {
        state().set_style(UIStyleType::DEFAULT);
        m_icon.state().set_style(UIStyleType::DEFAULT);
    }

    state().update(dt);
}
