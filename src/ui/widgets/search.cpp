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
        : Widget("search-input"), m_label("##{}-search-input"), m_value(&value), m_icon() {

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

        m_icon.set_texture(search_icon);
        m_icon.set_size(ICON_SIZE);

        m_icon.state().set_for_all_styles([](Style& style) {
            style.color.set({120, 120, 120, 255});
            style.color.speed = ALPHA_ANIM_SPEED;
        });

        Style& icon_hover_style = m_icon.state().get_style(StyleType::HOVER);
        Style& icon_active_style = m_icon.state().get_style(StyleType::ACTIVE);

        icon_hover_style.color.set({200, 200, 200, 255});
        icon_active_style.color.set({200, 200, 200, 255});

        state().snap_to_style(StyleType::DEFAULT);
        m_icon.state().snap_to_style(StyleType::DEFAULT);
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

    void SearchInputWidget::on_draw() {
        if (!state().is_visible()) {
            return;
        }

        const float dt = ImGui::GetIO().DeltaTime;
        ImVec2 size = m_size;
        {
            const ImVec2 available = ImGui::GetContentRegionAvail();

            if (m_fit_width) {
                size.x = available.x;
            }

        // let imgui grow
            size.y = 0.0f;
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

        ImGui::BeginChild("##search-input", size, child_flags, constants::WIDGET_WINDOW_FLAGS);

        const ImVec2 available = ImGui::GetContentRegionAvail();
        const float frame_height = ImGui::GetFrameHeight();
        const float row_start_y = ImGui::GetCursorPosY();

        ImGui::SetCursorPosY(row_start_y + (available.y - m_icon.get_size().y) * 0.5f);

        m_icon.draw();

        ImGui::SameLine(0.0f, 10.0f);
        ImGui::SetCursorPosY(row_start_y + (available.y - frame_height) * 0.5f);

        const float input_width = std::max(0.0f, size.x - m_icon.get_size().x - 10.0f);
        ImGui::SetNextItemWidth(input_width);
        ImGui::InputText(m_label.c_str(), m_value);

        // imgui owns text editing; the router only mirrors the
        // item's hit region and focus so overlays can arbitrate keyboard input.
        auto& input_router = current().input_router();
        const bool debugger_mode = input_router.debug_select_mode();
        const bool is_active = !debugger_mode && ImGui::IsItemActive();
        const bool is_hovered = !debugger_mode && ImGui::IsItemHovered();
        const bool registered = state().accepts_input() && input_router.register_last_item(*this);
        static_cast<void>(registered);
        if (is_active && state().accepts_input()) {
            const bool focused = input_router.set_focus(*this);
            static_cast<void>(focused);
        } else if (input_router.focused_node() == this) {
            input_router.clear_focus();
        }

        if (is_active) {
            state().set_style(StyleType::ACTIVE);
            m_icon.state().set_style(StyleType::ACTIVE);
        } else if (is_hovered) {
            state().set_style(StyleType::HOVER);
            m_icon.state().set_style(StyleType::HOVER);
        } else {
            state().set_style(StyleType::DEFAULT);
            m_icon.state().set_style(StyleType::DEFAULT);
        }

        state().update(dt);
        const Style& style = state().get_style();
        draw_child_rect(style.border_color.get_col(), style.border_radius, style.border_thickness);

        ImGui::EndChild();
        ImGui::PopID();
        ImGui::PopStyleVar(3);
        ImGui::PopStyleColor(3);
    }

} // namespace ui
