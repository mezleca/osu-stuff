#include "search.hpp"
#include "../custom.hpp"

#include <imgui_stdlib.h>
#include <format>

static constexpr float ALPHA_ANIM_SPEED = 12.0f;

SearchInputWidget::SearchInputWidget(UI* ui, IconTexture* icon) : UIWidget(ui, "search-input") {
    if (icon) {
        m_icon = icon;
    }
}

void SearchInputWidget::show() {
    const float icon_size = 18.0f;
    const float dt = ImGui::GetIO().DeltaTime;

    ImVec2 size = m_state.m_size;

    {
        const ImVec2 available = ImGui::GetContentRegionAvail();

        if (m_state.m_fit_width) {
            size.x = available.x;
        }

        // let imgui grow
        size.y = 0.0f;
    }

    auto label = std::format("##{}", m_state.m_label);

    auto window_flags = ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse;
    auto child_flags =
        ImGuiChildFlags_AlwaysUseWindowPadding | ImGuiChildFlags_AutoResizeX | ImGuiChildFlags_AutoResizeY;

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, ui_theme::BOX_ROUNDING);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 2.0f});
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    auto border_color = ImColor(ui_theme::BORDER_COLOR);

    ImGui::BeginChild(label.c_str(), size, child_flags, window_flags);
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        const float frame_height = ImGui::GetFrameHeight();
        const float row_start_y = ImGui::GetCursorPosY();

        ImGui::SetCursorPosY(row_start_y + (available.y - icon_size) * 0.5f);
        custom_imgui::image(m_icon, {icon_size, icon_size}, m_state.style.m_icon_color);

        ImGui::SameLine(0.0f, 10.0f);
        ImGui::SetCursorPosY(row_start_y + (available.y - frame_height) * 0.5f);

        ImGui::SetNextItemWidth(size.x);
        ImGui::InputText(label.c_str(), &m_state.m_value);

        const bool is_active = ImGui::IsItemActive();
        const bool is_hovered = ImGui::IsItemHovered();

        if (is_active) {
            border_color = ImColor(ui_theme::ACCENT_COLOR);
        } else if (is_hovered) {
            border_color = ImColor(ui_theme::ACCENT_HOVER_COLOR);
        }
    }
    ImGui::EndChild();
    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(3);

    m_state.style.m_border_color.tick(border_color, ALPHA_ANIM_SPEED * 2, dt);

    const ImVec2 rect_min = ImGui::GetItemRectMin();
    const ImVec2 rect_max = ImGui::GetItemRectMax();

    auto* dl = ImGui::GetWindowDrawList();
    dl->AddRect(rect_min, rect_max, ImColor(m_state.style.m_border_color.value), ui_theme::BOX_ROUNDING, 0, 4.0f);
}
