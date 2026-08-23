#include "range.hpp"

#include "../style/theme.hpp"
#include "../imgui/draw.hpp"
#include "../ui.hpp"

#include <imgui.h>

#include <algorithm>
#include <cmath>
#include <format>

namespace ui {
    class RangeThumbNode final : public Widget {
    public:
        explicit RangeThumbNode(std::string id) : Widget(std::move(id)) {}

        void set_data(Rect rect, float value) {
            m_rect = rect;
            m_text = std::format("{:.1f}", value);
        }

    private:
        [[nodiscard]] bool on_draw() override {
            const Style& current_style = style();
            const ImVec2 padding = current_style.padding();
            const ImVec2 minimum = {m_rect.min.x + padding.x, m_rect.min.y + padding.y};
            const ImVec2 maximum = {m_rect.max.x - padding.x, m_rect.max.y - padding.y};

            if (current_style.border() != BORDER_NONE) {
                draw_frame(
                    minimum, maximum, current_style.background_color().get_col(),
                    current_style.border_color().get_col(), current_style.border_radius(),
                    current_style.border_thickness()
                );
            } else {
                ImGui::GetWindowDrawList()->AddRectFilled(
                    minimum, maximum, current_style.background_color().get_col(), current_style.border_radius()
                );
            }

            ImFont* font = current_style.font() == nullptr ? ImGui::GetFont() : current_style.font();
            ImGui::PushFont(font);
            const ImVec2 text_size = ImGui::CalcTextSize(m_text.c_str());
            const ImVec2 text_position = {
                minimum.x + (maximum.x - minimum.x - text_size.x) * 0.5F,
                minimum.y + (maximum.y - minimum.y - text_size.y) * 0.5F,
            };
            draw_text(text_position, current_style.color().get_col(), m_text);
            ImGui::PopFont();

            return true;
        }

        Rect m_rect{};
        std::string m_text;
    };

    RangeWidget::RangeWidget(UI& ui, float& minimum, float& maximum, std::string id)
        : Widget(std::move(id), WidgetType::Range), m_ui(ui), m_minimum(&minimum), m_maximum(&maximum) {
        m_minimum_thumb = &add_child<RangeThumbNode>("minimum-thumb");
        m_maximum_thumb = &add_child<RangeThumbNode>("maximum-thumb");
        configure_style();
    }

    void RangeWidget::configure_style() {
        const Theme& theme = m_ui.theme();

        state().configure_all_styles([&theme](Style& style) {
            style.color(theme.text_color)
                .background_color(theme.control_background_color)
                .border_color(theme.control_border_color, 18.0F)
                .padding({10.0F, 6.0F})
                .border(BORDER_ALL)
                .border_radius(theme.control_rounding)
                .border_thickness(theme.control_border_thickness);
        });

        state().configure_style(StyleType::HOVER, [&theme](Style& style) {
            style.border_color(theme.accent_hover_color);
        });

        state().configure_style(StyleType::ACTIVE, [&theme](Style& style) { style.border_color(theme.accent_color); });

        ImFont* value_font = m_ui.get_secondary_font(13);

        const auto configure_thumb = [&theme](RangeThumbNode& thumb) {
            thumb.state().configure_all_styles([&theme](Style& style) {
                style.color(theme.background_color)
                    .background_color(theme.text_color)
                    .border_radius(theme.control_rounding);
            });
        };

        configure_thumb(*m_minimum_thumb);
        configure_thumb(*m_maximum_thumb);

        m_minimum_thumb->set_font(value_font);
        m_maximum_thumb->set_font(value_font);
    }

    RangeWidget& RangeWidget::set_label(std::string label) {
        m_label = std::move(label);
        return *this;
    }

    RangeWidget& RangeWidget::set_bounds(float minimum, float maximum) {
        m_lower_bound = std::min(minimum, maximum);
        m_upper_bound = std::max(minimum, maximum);
        normalize_values();
        return *this;
    }

    RangeWidget& RangeWidget::set_step(float step) {
        m_step = std::max(std::abs(step), 0.0001F);
        normalize_values();
        return *this;
    }

    RangeWidget& RangeWidget::set_size(ImVec2 size) {
        layout().set_size(size);
        return *this;
    }

    bool RangeWidget::changed() const {
        return m_changed;
    }

    void RangeWidget::draw_children() {
        // thumbs need track geometry produced by on_draw(), so draw_track()
        // renders the child nodes after their rectangles have been resolved.
    }

    Widget& RangeWidget::minimum_thumb() {
        return *m_minimum_thumb;
    }

    Widget& RangeWidget::maximum_thumb() {
        return *m_maximum_thumb;
    }

    void RangeWidget::on_layout() {
        if (m_label.empty()) {
            return;
        }

        const float minimum_height = ImGui::GetTextLineHeightWithSpacing() + 32.0F;
        if (layout().size().y < minimum_height) {
            layout().set_size({layout().size().x, minimum_height});
        }
    }

    void RangeWidget::normalize_values() {
        const float span = m_upper_bound - m_lower_bound;
        if (span < m_step) {
            *m_minimum = m_lower_bound;
            *m_maximum = m_upper_bound;
            return;
        }

        *m_minimum = std::clamp(*m_minimum, m_lower_bound, m_upper_bound - m_step);
        *m_maximum = std::clamp(*m_maximum, *m_minimum + m_step, m_upper_bound);
    }

    float RangeWidget::value_position(float value, float track_start, float track_width) const {
        const float span = m_upper_bound - m_lower_bound;
        if (span <= 0.0F) {
            return track_start;
        }

        return track_start + (value - m_lower_bound) * track_width / span;
    }

    void RangeWidget::update_value_from_input(float track_start, float track_width, float minimum_x, float maximum_x) {
        if (ImGui::IsItemActivated()) {
            // the closest thumb wins for the whole drag, avoiding thumb switching
            // when both values approach each other.
            m_minimum_active =
                std::abs(ImGui::GetMousePos().x - minimum_x) <= std::abs(ImGui::GetMousePos().x - maximum_x);
        }

        const float span = m_upper_bound - m_lower_bound;
        if (!ImGui::IsItemActive() || track_width <= 0.0F || span < m_step) {
            return;
        }

        const float raw = m_lower_bound + (ImGui::GetMousePos().x - track_start) * span / track_width;
        const float snapped = m_lower_bound + std::round((raw - m_lower_bound) / m_step) * m_step;
        const float minimum = m_minimum_active ? m_lower_bound : *m_minimum + m_step;
        const float maximum = m_minimum_active ? *m_maximum - m_step : m_upper_bound;
        const float value = std::clamp(snapped, minimum, maximum);

        float& active_value = m_minimum_active ? *m_minimum : *m_maximum;
        if (value != active_value) {
            active_value = value;
            m_changed = true;
        }
    }

    void RangeWidget::draw_track(Rect track, float minimum_x, float maximum_x, float thumb_width) {
        const Style& current_style = style();
        ImDrawList* draw_list = ImGui::GetWindowDrawList();

        draw_frame(
            track.min, track.max, current_style.background_color().get_col(), current_style.border_color().get_col(),
            current_style.border_radius(), current_style.border_thickness()
        );

        draw_list->AddRectFilled(
            {minimum_x, track.min.y}, {maximum_x, track.max.y}, ImGui::GetColorU32(m_ui.theme().accent_color),
            current_style.border_radius()
        );

        const float thumb_half = thumb_width * 0.5F;
        const ImVec2 thumb_size = {thumb_width, track.size().y};

        m_minimum_thumb->set_data(
            Rect::from_position_size({minimum_x - thumb_half, track.min.y}, thumb_size), *m_minimum
        );

        m_maximum_thumb->set_data(
            Rect::from_position_size({maximum_x - thumb_half, track.min.y}, thumb_size), *m_maximum
        );

        m_minimum_thumb->draw();
        m_maximum_thumb->draw();
    }

    bool RangeWidget::on_draw() {
        if (!state().is_visible()) {
            return false;
        }

        normalize_values();

        const float label_height = m_label.empty() ? 0.0F : ImGui::GetTextLineHeightWithSpacing();
        const float height = std::max(32.0F, layout().size().y - label_height);
        const float width = layout().size().x > 0.0F ? layout().size().x : ImGui::GetContentRegionAvail().x;

        ImGui::PushID(this);
        const float content_x = ImGui::GetCursorPosX();

        if (!m_label.empty()) {
            ImGui::TextUnformatted(m_label.c_str());
            ImGui::SetCursorPosX(content_x);
        }

        ImGui::InvisibleButton("##range", {width, height});

        const ImVec2 track_min = ImGui::GetItemRectMin();
        const ImVec2 track_max = ImGui::GetItemRectMax();
        const float thumb_width = std::min(height, 32.0F);
        const float value_track_start = track_min.x + thumb_width * 0.5F;
        const float value_track_width = std::max(0.0F, track_max.x - track_min.x - thumb_width);

        float minimum_x = value_position(*m_minimum, value_track_start, value_track_width);
        float maximum_x = value_position(*m_maximum, value_track_start, value_track_width);

        m_changed = false;
        update_value_from_input(value_track_start, value_track_width, minimum_x, maximum_x);

        // input may have changed one endpoint, so visual geometry is resolved again
        // before track fill and thumb nodes are drawn.
        minimum_x = value_position(*m_minimum, value_track_start, value_track_width);
        maximum_x = value_position(*m_maximum, value_track_start, value_track_width);
        draw_track({track_min, track_max}, minimum_x, maximum_x, thumb_width);

        const ItemInputState input = m_ui.input().observe(*this);
        ImGui::PopID();

        apply_input_state(input);
        return true;
    }
} // namespace ui
