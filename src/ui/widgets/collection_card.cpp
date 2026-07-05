#include "collection_card.hpp"
#include "../ui.hpp"
#include "../custom.hpp"

#include <format>

constexpr float ALPHA_ANIM_SPEED = 25.0f;

CollectionCardWidget::CollectionCardWidget(UI* ui, std::string name, IconTexture* icon)
    : UIWidget(ui, "collection-card"), m_name(name), m_count("0 maps") {
    m_state.m_font = m_ui->m_fonts[TORUS_SEMI].get(18);
    m_state.m_font_small = m_ui->m_fonts[TORUS_SEMI].get(14);

    if (icon) {
        m_icon = icon;
    } else {
        m_icon = m_ui->get_texture("default");
    }
}

void CollectionCardWidget::show() {
    const float icon_size = 16.0f;
    const float dt = ImGui::GetIO().DeltaTime;

    ImVec2 size = m_state.m_size;

    // collection card will always use the full width
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        size.x = available.x;
    }

    auto window_flags = ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse;
    auto child_flags = ImGuiChildFlags_AlwaysUseWindowPadding;

    auto border_color = m_state.m_selected ? ui_theme::ACCENT_COLOR_HALF : ui_theme::TRANSPARENT;
    auto bg_color = m_state.m_selected ? ui_theme::ACCENT_COLOR_SECONDARY : ui_theme::TRANSPARENT;

    m_state.style.m_border_color.tick(border_color, ALPHA_ANIM_SPEED, dt);
    m_state.style.m_bg_color.tick(bg_color, ALPHA_ANIM_SPEED, dt);

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, ui_theme::BOX_ROUNDING);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 0.0f});

    ImGui::PushStyleColor(ImGuiCol_ChildBg, m_state.style.m_bg_color.value);
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    ImGui::BeginChild(m_name.c_str(), size, child_flags, window_flags);
    {
        ImGui::PushFont(m_state.m_font);

        const ImVec2 available = ImGui::GetContentRegionAvail();
        const float row_start_y = ImGui::GetCursorPosY();

        // music icon
        {
            ImGui::SetCursorPosY(row_start_y + (available.y - icon_size) * 0.5f);
            custom_imgui::image(m_icon, {icon_size, icon_size}, m_state.style.m_icon_color);
        }

        // name
        {
            ImGui::SameLine(0.0f, 10.0f);
            ImGui::SetCursorPosY(row_start_y + (available.y - m_name.text_size().y) * 0.5f);
            ImGui::TextUnformatted(m_name.c_str());
        }

        // count
        {
            ImGui::PushFont(m_state.m_font_small);
            ImGui::SameLine();

            ImGui::SetCursorPosX(available.x - m_count.text_size().x);
            ImGui::SetCursorPosY(row_start_y + (available.y - m_count.text_size().y) * 0.5f);

            ImGui::TextUnformatted(m_count.c_str());
            ImGui::PopFont();
        }

        ImGui::PopFont();
    }
    ImGui::EndChild();
    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(4);

    const ImVec2 rect_min = ImGui::GetItemRectMin();
    const ImVec2 rect_max = ImGui::GetItemRectMax();

    bool hovering_rect = ImGui::IsMouseHoveringRect(rect_min, rect_max);

    if (on_click && hovering_rect && ImGui::IsMouseClicked(ImGuiMouseButton_Left)) {
        on_click();
    }

    if (on_context && hovering_rect && ImGui::IsMouseClicked(ImGuiMouseButton_Right)) {
        on_context();
    }

    auto* dl = ImGui::GetWindowDrawList();
    dl->AddRect(rect_min, rect_max, ImColor(m_state.style.m_border_color.value), ui_theme::BOX_ROUNDING, 0, 1.0f);
}
