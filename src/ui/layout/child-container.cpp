#include "child-container.hpp"

#include "../constants.hpp"
#include "../style/style.hpp"

namespace ui {
    ChildContainer::ChildContainer(std::string id, WidgetType type) : Widget(std::move(id), type) {
        const Theme& theme = Style::default_theme_values();
        state().configure_all_styles([&theme](Style& style) {
            style.padding({theme.content_padding, theme.content_padding}).border_radius(theme.box_rounding);
        });
    }

    ChildContainer& ChildContainer::set_size(ImVec2 size) {
        m_fit_width = size.x <= 0.0F;
        layout().set_size(size);
        return *this;
    }

    const ImVec2& ChildContainer::size() const {
        return layout().size();
    }

    Rect ChildContainer::rect() const {
        return m_child_rect;
    }

    ChildContainer& ChildContainer::set_scrollable(bool scrollable) {
        m_scrollable = scrollable;
        return *this;
    }

    ChildContainer& ChildContainer::set_anchor(Anchor anchor) {
        layout().set_anchor(anchor);
        return *this;
    }

    ChildContainer& ChildContainer::set_anchor_position(ImVec2 relative_position) {
        layout().set_anchor_position(relative_position);
        return *this;
    }

    ChildContainer& ChildContainer::set_origin(Origin origin) {
        layout().set_origin(origin);
        return *this;
    }

    ChildContainer& ChildContainer::set_origin_position(ImVec2 relative_position) {
        layout().set_origin_position(relative_position);
        return *this;
    }

    ChildContainer& ChildContainer::set_offset(ImVec2 offset) {
        layout().set_offset(offset);
        return *this;
    }

    void ChildContainer::on_layout() {
        if (!m_fit_width) {
            return;
        }

        const ImVec2 size = resolve_layout_size(layout().size(), ImGui::GetContentRegionAvail());
        layout().set_size(size);
    }

    bool ChildContainer::on_draw() {
        const Style& current_style = state().style();
        const bool has_full_border = (current_style.border() & BORDER_ALL) != 0;
        ImGuiChildFlags child_flags = ImGuiChildFlags_AlwaysUseWindowPadding;
        ImGuiWindowFlags window_flags = constants::WIDGET_WINDOW_FLAGS;
        if (m_scrollable) {
            window_flags &= ~(ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse);
        }

        if (layout().size().x <= 0.0F) child_flags |= ImGuiChildFlags_AutoResizeX;
        if (layout().size().y <= 0.0F) child_flags |= ImGuiChildFlags_AutoResizeY;

        if (has_full_border) child_flags |= ImGuiChildFlags_Borders;

        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, current_style.padding());

        if (has_full_border) ImGui::PushStyleVar(ImGuiStyleVar_ChildBorderSize, current_style.border_thickness());

        ImGui::PushStyleColor(ImGuiCol_ChildBg, current_style.background_color().get());
        if (has_full_border) ImGui::PushStyleColor(ImGuiCol_Border, current_style.border_color().get());

        ImFont* current_font = current_style.font();
        if (current_font == nullptr) {
            current_font = ImGui::GetFont();
        }

        ImGui::PushFont(current_font);
        if (id().empty()) {
            ImGui::BeginChild(ImGui::GetID(this), layout().size(), child_flags, window_flags);
        } else {
            ImGui::BeginChild(id().c_str(), layout().size(), child_flags, window_flags);
        }
        ImGui::PopStyleVar();

        if (has_full_border) ImGui::PopStyleVar();
        ImGui::PopStyleColor();
        if (has_full_border) ImGui::PopStyleColor();

        return true;
    }

    void ChildContainer::on_draw_end() {
        const ImVec2 window_position = ImGui::GetWindowPos();
        const ImVec2 window_size = ImGui::GetWindowSize();

        m_child_rect = Rect::from_position_size(window_position, window_size);
        layout().set_screen_rect(m_child_rect);

        ImGui::PopFont();
        ImGui::EndChild();

        draw_borders();
        state().update(ImGui::GetIO().DeltaTime);
    }

    void ChildContainer::draw_borders() {
        ImDrawList* draw_list = ImGui::GetWindowDrawList();

        const ImVec2& min = m_child_rect.min;
        const ImVec2& max = m_child_rect.max;

        const Style& current_style = state().style();
        const auto border_color = current_style.border_color().get_col();
        const auto border_thickness = current_style.border_thickness();

        if (current_style.border() == BORDER_NONE || (current_style.border() & BORDER_ALL) != 0) {
            return;
        }

        if (current_style.border() & BORDER_TOP) {
            draw_list->AddLine({min.x, min.y}, {max.x, min.y}, border_color, border_thickness);
        }

        if (current_style.border() & BORDER_BOTTOM) {
            draw_list->AddLine({min.x, max.y}, {max.x, max.y}, border_color, border_thickness);
        }

        if (current_style.border() & BORDER_LEFT) {
            draw_list->AddLine({min.x, min.y}, {min.x, max.y}, border_color, border_thickness);
        }

        if (current_style.border() & BORDER_RIGHT) {
            draw_list->AddLine({max.x, min.y}, {max.x, max.y}, border_color, border_thickness);
        }
    }
} // namespace ui
