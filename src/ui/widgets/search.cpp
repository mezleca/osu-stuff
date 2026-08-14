#include "search.hpp"
#include "../ui.hpp"
#include "../core/draw.hpp"
#include "../theme.hpp"
#include "../constants.hpp"

#include <imgui_stdlib.h>

static constexpr float ALPHA_ANIM_SPEED = 12.0f;
static constexpr ImVec2 ICON_SIZE = {18.0f, 18.0f};

namespace ui {
    SearchInputWidget::SearchInputWidget(std::string& value)
        : Widget("search-input"), m_label("##{}-search-input"), m_value(&value) {

        auto search_icon = current().get_texture("search-icon");

        state().set_for_all_styles([](Style& style) {
            style.border_color.value = ui_theme::BORDER_COLOR;
            style.border_color.speed = ALPHA_ANIM_SPEED * 2.0f;
        });

        Style& active_style = state().get_style(StyleType::ACTIVE);
        Style& hover_style = state().get_style(StyleType::HOVER);
        active_style.border_color.value = ui_theme::ACCENT_COLOR;
        hover_style.border_color.value = ui_theme::ACCENT_COLOR;

        m_label.set({static_cast<void*>(this)});

        auto icon = std::make_unique<ImageWidget>();
        m_icon = icon.get();
        m_icon->set_texture(search_icon);
        m_icon->set_size(ICON_SIZE);
        m_icon->layout().set_anchor(Anchor::CenterLeft);
        m_icon->layout().set_origin(Origin::CenterLeft);
        add_child(std::move(icon));

        m_icon->state().set_for_all_styles([](Style& style) {
            style.color.set({120, 120, 120, 255});
            style.color.speed = ALPHA_ANIM_SPEED;
        });

        Style& icon_hover_style = m_icon->state().get_style(StyleType::HOVER);
        Style& icon_active_style = m_icon->state().get_style(StyleType::ACTIVE);

        icon_hover_style.color.set({200, 200, 200, 255});
        icon_active_style.color.set({200, 200, 200, 255});
    }

    void SearchInputWidget::set_fit_width(bool value) {
        m_fit_width = value;
    }

    std::optional<std::string> SearchInputWidget::get_content() const {
        return m_value == nullptr ? std::nullopt : std::optional<std::string>{*m_value};
    }

    bool SearchInputWidget::set_content(std::string content) {
        if (m_value == nullptr || *m_value == content) {
            return false;
        }

        *m_value = std::move(content);
        return true;
    }

    void SearchInputWidget::on_layout() {
        ImVec2 size = m_size;
        if (m_fit_width) {
            size.x = ImGui::GetContentRegionAvail().x;
        }

        // let imgui grow vertically after the input has been emitted.
        size.y = 0.0f;
        layout().set_size(size);
    }

    void SearchInputWidget::on_draw() {
        if (!state().is_visible()) {
            skip_draw();
            return;
        }

        const auto child_flags =
            ImGuiChildFlags_AlwaysUseWindowPadding | ImGuiChildFlags_AutoResizeX | ImGuiChildFlags_AutoResizeY;

        ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, ui_theme::BOX_ROUNDING);
        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 2.0f});
        ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
        ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
        ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
        ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);
        ImGui::PushID(this);

        ImGui::BeginChild("##search-input", layout().size(), child_flags, constants::WIDGET_WINDOW_FLAGS);
    }

    void SearchInputWidget::draw_children() {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        const float frame_height = ImGui::GetFrameHeight();
        const float row_start_y = ImGui::GetCursorPosY();

        m_icon->draw();

        ImGui::SameLine(0.0f, 10.0f);
        ImGui::SetCursorPosY(row_start_y + (available.y - frame_height) * 0.5f);

        const float input_width = std::max(0.0f, layout().size().x - m_icon->get_size().x - 10.0f);
        ImGui::SetNextItemWidth(input_width);
        ImGui::InputText(m_label.c_str(), m_value);

        m_input_state = current().input_router().observe_last_item(
            *this, {.accepts_input = state().accepts_input(), .focus_when_active = true}
        );
    }

    void SearchInputWidget::on_draw_end() {
        const float dt = ImGui::GetIO().DeltaTime;

        state().set_item_state(m_input_state.hovered, m_input_state.active);
        m_icon->state().set_item_state(m_input_state.hovered, m_input_state.active);

        state().update(dt);
        const Style& style = state().get_style();
        draw_child_rect(style.border_color.get_col(), style.border_radius, style.border_thickness);

        ImGui::EndChild();
        ImGui::PopID();
        ImGui::PopStyleVar(3);
        ImGui::PopStyleColor(3);
    }

} // namespace ui
