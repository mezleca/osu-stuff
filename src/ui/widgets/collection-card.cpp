#include "collection-card.hpp"
#include "../ui.hpp"
#include "../theme.hpp"
#include "../constants.hpp"

constexpr float ALPHA_ANIM_SPEED = 12.0f;
constexpr ImVec2 ICON_SIZE = {16.0f, 16.0f};

CollectionCardWidget::CollectionCardWidget(std::string name)
    : UIWidget("collection-card"), m_name(name), m_count("0 maps") {

    UI& ui = ui::current();
    UIStyle& active_style = state().get_style(UIStyleType::ACTIVE);
    UIStyle& hover_style = state().get_style(UIStyleType::HOVER);

    auto music_icon = ui.get_texture("music-icon");

    ImFont* font = ui.get_font(TORUS_SEMI).get(18);
    m_font_small = ui.get_font(TORUS_SEMI).get(14);

    state().set_for_all_styles([&](UIStyle& style) {
        style.font = font;

        style.border_thickness = 2.0f;

        style.border_color.value = ui_theme::TRANSPARENT;
        style.border_color.speed = ALPHA_ANIM_SPEED;

        style.background_color.value = ui_theme::TRANSPARENT;
        style.background_color.speed = ALPHA_ANIM_SPEED;
    });

    active_style.border_color.value = ui_theme::ACCENT_COLOR_HALF;
    active_style.background_color.value = ui_theme::ACCENT_COLOR_SECONDARY;
    hover_style.border_color.value = ui_theme::ACCENT_COLOR_HALF;

    m_icon.set_texture(music_icon);
    m_icon.set_size(ICON_SIZE);

    m_icon.state().set_for_all_styles([&](UIStyle& style) { style.color.set(ui_theme::ACCENT_COLOR); });

    state().snap_to_style(UIStyleType::DEFAULT);
    m_icon.state().snap_to_style(UIStyleType::DEFAULT);
}

void CollectionCardWidget::set_selected(bool value) {
    m_selected = value;
}

void CollectionCardWidget::toggle_selected() {
    m_selected = !m_selected;
}

bool CollectionCardWidget::is_selected() const {
    return m_selected;
}

void CollectionCardWidget::show() {
    if (!state().is_visible()) {
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const UIStyle& style = state().get_style();

    ImVec2 size = m_size;

    // collection card will always use the full width
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        size.x = available.x;
    }

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, ui_theme::BOX_ROUNDING);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 0.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleColor(ImGuiCol_ChildBg, style.background_color.get());
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);
    ImGui::PushID(this);

    ImGui::BeginChild(
        "##collection-card", size, ImGuiChildFlags_AlwaysUseWindowPadding, constants::WIDGET_WINDOW_FLAGS
    );
    {
        ImGui::PushFont(style.font);

        const ImVec2 available = ImGui::GetContentRegionAvail();
        const float row_start_y = ImGui::GetCursorPosY();

        // music icon
        {
            ImGui::SetCursorPosY(row_start_y + (available.y - m_icon.get_size().y) * 0.5f);
            m_icon.show();
        }

        // name
        {
            ImGui::SameLine(0.0f, 10.0f);
            ImGui::SetCursorPosY(row_start_y + (available.y - m_name.text_size().y) * 0.5f);
            ImGui::TextUnformatted(m_name.c_str());
        }

        // count
        {
            ImGui::PushFont(m_font_small);
            ImGui::SameLine();

            ImGui::SetCursorPosX(available.x - m_count.text_size().x);
            ImGui::SetCursorPosY(row_start_y + (available.y - m_count.text_size().y) * 0.5f);

            ImGui::TextUnformatted(m_count.c_str());
            ImGui::PopFont();
        }

        ui::current().draw_child_rect(style.border_color.get_col(), style.border_radius, style.border_thickness);

        ImGui::PopFont();
    }
    ImGui::EndChild();
    ImGui::PopID();
    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(4);

    bool hovering_rect = ImGui::IsItemHovered();

    if (hovering_rect) {
        if (m_onclick && ImGui::IsMouseClicked(ImGuiMouseButton_Left)) m_onclick();
        if (m_oncontext && ImGui::IsMouseClicked(ImGuiMouseButton_Right)) m_oncontext();
    }

    if (m_selected) {
        state().set_style(UIStyleType::ACTIVE);
    } else if (hovering_rect) {
        state().set_style(UIStyleType::HOVER);
    } else {
        state().set_style(UIStyleType::DEFAULT);
    }

    state().update(dt);
}
