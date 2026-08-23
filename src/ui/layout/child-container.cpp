#include "child-container.hpp"

#include "../constants.hpp"
#include "../imgui/draw.hpp"
#include "../style/style.hpp"

namespace ui {
    ChildContainer::ChildContainer(std::string id, WidgetType type) : Widget(std::move(id), type) {
        const Theme theme = Theme::defaults();
        configure_all_styles([&theme](Style& style) {
            style.padding({theme.content_padding, theme.content_padding}).border_radius(theme.box_rounding);
        });
    }

    ChildContainer& ChildContainer::set_scrollable(bool scrollable) {
        m_scrollable = scrollable;
        return *this;
    }

    ChildContainer& ChildContainer::set_center_content_vertically(bool enabled) {
        m_center_content_vertically = enabled;
        return *this;
    }

    void ChildContainer::on_layout() {
        const NodeLayout& current_layout = layout();
        if (size_was_resolved() || !has_size_request() || current_layout.desired_size().x > 0.0F) {
            return;
        }

        const ImVec2 size = resolve_layout_size(current_layout.desired_size(), ImGui::GetContentRegionAvail());
        resolve_size(size);
    }

    bool ChildContainer::on_draw() {
        const Style& current_style = style();
        const bool has_full_border = (current_style.border() & BORDER_ALL) != 0;
        ImGuiChildFlags child_flags = ImGuiChildFlags_AlwaysUseWindowPadding;
        ImGuiWindowFlags window_flags = constants::WIDGET_WINDOW_FLAGS;
        if (m_scrollable) {
            window_flags &= ~(ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse);
        }

        if (layout().size().x <= 0.0F) child_flags |= ImGuiChildFlags_AutoResizeX;
        if (layout().size().y <= 0.0F) child_flags |= ImGuiChildFlags_AutoResizeY;

        if (has_full_border) child_flags |= ImGuiChildFlags_Borders;

        ImVec2 padding = current_style.padding();
        if (m_center_content_vertically && layout().size().y > 0.0F) {
            padding.y = std::max(0.0F, (layout().size().y - ImGui::GetFontSize()) * 0.5F);
        }
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, padding);

        if (has_full_border) ImGui::PushStyleVar(ImGuiStyleVar_ChildBorderSize, current_style.border_thickness());

        ImGui::PushStyleColor(ImGuiCol_ChildBg, current_style.background_color().get_col());
        if (has_full_border) ImGui::PushStyleColor(ImGuiCol_Border, current_style.border_color().get_col());

        ImFont* current_font = current_style.font();
        if (current_font == nullptr) {
            current_font = ImGui::GetFont();
        }

        ImGui::PushFont(current_font);
        // beginchild copies window padding, border and background into the child;
        // those temporary values can be popped while the child scope stays open.
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
        // use the child window itself rather than its last item so padding,
        // scrolling and empty containers still have reliable outer bounds.
        set_screen_rect(m_child_rect);

        ImGui::PopFont();
        ImGui::EndChild();

        draw_borders();
    }

    void ChildContainer::draw_borders() {
        const ImVec2& min = m_child_rect.min;
        const ImVec2& max = m_child_rect.max;

        const Style& current_style = style();
        const ImU32 border_color = current_style.border_color().get_col();
        const auto border_thickness = current_style.border_thickness();

        if (current_style.border() == BORDER_NONE || (current_style.border() & BORDER_ALL) != 0) {
            return;
        }

        if (current_style.border() & BORDER_TOP) {
            draw_line({min.x, min.y}, {max.x, min.y}, border_color, border_thickness);
        }

        if (current_style.border() & BORDER_BOTTOM) {
            draw_line({min.x, max.y}, {max.x, max.y}, border_color, border_thickness);
        }

        if (current_style.border() & BORDER_LEFT) {
            draw_line({min.x, min.y}, {min.x, max.y}, border_color, border_thickness);
        }

        if (current_style.border() & BORDER_RIGHT) {
            draw_line({max.x, min.y}, {max.x, max.y}, border_color, border_thickness);
        }
    }
} // namespace ui
