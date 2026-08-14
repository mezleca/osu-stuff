#include "collection-card.hpp"
#include "../../../ui/ui.hpp"
#include "../../../ui/core/draw.hpp"
#include "../theme.hpp"
#include "../../../ui/constants.hpp"

constexpr float ALPHA_ANIM_SPEED = 12.0f;
constexpr ImVec2 ICON_SIZE = {16.0f, 16.0f};

CollectionCardWidget::CollectionCardWidget(std::string name)
    : ui::Widget("collection-card"), m_name(name), m_count("0 maps") {

    UI& ui = ui::current();
    ui::Style& active_style = state().get_style(ui::StyleType::ACTIVE);
    ui::Style& hover_style = state().get_style(ui::StyleType::HOVER);

    auto music_icon = ui.get_texture("music-icon");

    ImFont* font = ui.get_font(ui::FontType::SEMIBOLD).get(18);
    m_font_small = ui.get_font(ui::FontType::SEMIBOLD).get(14);

    state().set_for_all_styles([&](ui::Style& style) {
        style.font = font;

        style.border_thickness = 2.0f;

        style.border_color.value = app_theme::TRANSPARENT;
        style.border_color.speed = ALPHA_ANIM_SPEED;

        style.background_color.value = app_theme::TRANSPARENT;
        style.background_color.speed = ALPHA_ANIM_SPEED;
    });

    active_style.border_color.value = app_theme::ACCENT_COLOR_HALF;
    active_style.background_color.value = app_theme::ACCENT_COLOR_SECONDARY;
    hover_style.border_color.value = app_theme::ACCENT_COLOR_HALF;

    m_icon.set_texture(music_icon);
    m_icon.set_size(ICON_SIZE);

    m_icon.state().set_for_all_styles([&](ui::Style& style) { style.color.set(app_theme::ACCENT_COLOR); });

    state().snap_to_style(ui::StyleType::DEFAULT);
    m_icon.state().snap_to_style(ui::StyleType::DEFAULT);
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

std::optional<std::string> CollectionCardWidget::get_content() const {
    return m_name.str();
}

bool CollectionCardWidget::set_content(std::string content) {
    if (content == m_name.str()) {
        return false;
    }

    m_name.set(std::move(content));
    return true;
}

void CollectionCardWidget::on_draw() {
    if (!state().is_visible()) {
        return;
    }

    const float dt = ImGui::GetIO().DeltaTime;
    const ui::Style& style = state().get_style();

    ImVec2 size = m_size;

    // collection card will always use the full width
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        size.x = available.x;
    }

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, app_theme::BOX_ROUNDING);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 0.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleColor(ImGuiCol_ChildBg, style.background_color.get());
    ImGui::PushStyleColor(ImGuiCol_FrameBg, app_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, app_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, app_theme::TRANSPARENT);
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
            m_icon.draw();
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

        ui::draw_child_rect(style.border_color.get_col(), style.border_radius, style.border_thickness);

        ImGui::PopFont();
    }
    ImGui::EndChild();
    ImGui::PopID();
    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(4);

    const bool handled = state().accepts_input() && ui::current().input_router().dispatch_last_item(*this);
    static_cast<void>(handled);
    const bool hovering_rect = !ui::current().input_router().debug_select_mode() && ImGui::IsItemHovered();

    if (m_selected) {
        state().set_style(ui::StyleType::ACTIVE);
    } else if (hovering_rect) {
        state().set_style(ui::StyleType::HOVER);
    } else {
        state().set_style(ui::StyleType::DEFAULT);
    }

    state().update(dt);
}
