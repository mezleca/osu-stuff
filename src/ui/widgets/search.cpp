#include "search.hpp"
#include "../ui.hpp"
#include "../theme.hpp"

#include <imgui_stdlib.h>

static constexpr float ALPHA_ANIM_SPEED = 12.0f;

SearchInputWidget::SearchInputWidget(std::string& value, IconTexture* icon)
    : UIWidget("search-input"), m_label("##{}-search-input"), m_value(&value), m_icon(icon), m_icon_image(icon) {

    UI& ui = ui::current();

    state().set_for_all_styles([](UIStyle& style) {
        UIWidgetColor icon_color;
        icon_color.value = {120, 120, 120, 255};
        icon_color.speed = ALPHA_ANIM_SPEED;
        style.border_color.speed = ALPHA_ANIM_SPEED * 2.0f;
        style.variables().set("icon_color", icon_color);
    });

    UIStyle& active_style = state().get_style(UIStyleType::ACTIVE);
    UIStyle& hover_style = state().get_style(UIStyleType::HOVER);

    UIWidgetColor* hover_icon_color = hover_style.variables().get<UIWidgetColor>("icon_color");

    if (hover_icon_color != nullptr) {
        hover_icon_color->value = ImColor(150, 150, 150, 255).Value;
    }

    hover_style.border_color.value = ui_theme::ACCENT_COLOR;
    active_style.border_color.value = ui_theme::ACCENT_COLOR;

    state().snap_to_style(UIStyleType::DEFAULT);
    m_label.set({static_cast<void*>(this)});

    if (m_icon == nullptr) {
        m_icon = ui.get_texture("default");
    }

    m_icon_image.set_texture(m_icon);
}

void SearchInputWidget::set_fit_width(bool value) {
    m_fit_width = value;
}

void SearchInputWidget::show() {
    if (!state().is_visible()) {
        return;
    }

    const float icon_size = 18.0f;
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
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    ImGui::BeginChild(m_label.c_str(), size, child_flags, window_flags);

    const ImVec2 available = ImGui::GetContentRegionAvail();
    const float frame_height = ImGui::GetFrameHeight();
    const float row_start_y = ImGui::GetCursorPosY();

    ImGui::SetCursorPosY(row_start_y + (available.y - icon_size) * 0.5f);
    const UIWidgetColor* icon_color = style.variables().get<UIWidgetColor>("icon_color");
    m_icon_image.set_size({icon_size, icon_size});
    m_icon_image.set_color(icon_color != nullptr ? icon_color->value : ImColor{});
    m_icon_image.show();

    ImGui::SameLine(0.0f, 10.0f);
    ImGui::SetCursorPosY(row_start_y + (available.y - frame_height) * 0.5f);

    ImGui::SetNextItemWidth(size.x);
    ImGui::InputText(m_label.c_str(), m_value);

    const bool is_active = ImGui::IsItemActive();
    const bool is_hovered = ImGui::IsItemHovered();

    ImGui::EndChild();
    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(3);

    if (is_active) {
        state().set_style(UIStyleType::ACTIVE);
    } else if (is_hovered) {
        state().set_style(UIStyleType::HOVER);
    } else {
        state().set_style(UIStyleType::DEFAULT);
    }

    state().update(dt);

    const ImVec2 rect_min = ImGui::GetItemRectMin();
    const ImVec2 rect_max = ImGui::GetItemRectMax();

    auto* dl = ImGui::GetWindowDrawList();
    dl->AddRect(rect_min, rect_max, ImColor(style.border_color.value), ui_theme::BOX_ROUNDING, 0, 4.0f);
}
