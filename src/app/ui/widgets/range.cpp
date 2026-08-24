#include "range.hpp"

#include <ui/imgui/draw.hpp>
#include <ui/ui.hpp>

#include <imgui.h>

#include <algorithm>
#include <cmath>
#include <format>
#include <utility>

class AppRangeThumbNode final : public ui::Widget {
public:
    explicit AppRangeThumbNode(std::string id) : Widget(std::move(id)) {}

    void set_data(ui::Rect rect, float value) {
        m_rect = rect;
        m_text = std::format("{:.1f}", value);
    }

private:
    [[nodiscard]] bool on_draw() override {
        const ui::Style& current_style = style();
        set_screen_rect(m_rect);
        const ImVec2 padding = current_style.padding();
        const ImVec2 minimum = {m_rect.min.x + padding.x, m_rect.min.y + padding.y};
        const ImVec2 maximum = {m_rect.max.x - padding.x, m_rect.max.y - padding.y};

        ui::draw_frame({minimum, maximum}, current_style);

        const ImVec2 text_size = ImGui::CalcTextSize(m_text.c_str());
        const ImVec2 text_position = {
            minimum.x + (maximum.x - minimum.x - text_size.x) * 0.5F,
            minimum.y + (maximum.y - minimum.y - text_size.y) * 0.5F,
        };
        ui::draw_text(text_position, current_style.color().get_col(), m_text);

        return true;
    }

    ui::Rect m_rect{};
    std::string m_text;
};

RangeWidget::RangeWidget(UI& ui, float& minimum, float& maximum, std::string id)
    : Widget(std::move(id), "Range"), m_ui(ui), m_minimum(&minimum), m_maximum(&maximum) {
    m_minimum_thumb = &add_child<AppRangeThumbNode>("minimum-thumb");
    m_maximum_thumb = &add_child<AppRangeThumbNode>("maximum-thumb");
    configure_default_styles();
}

void RangeWidget::configure_default_styles() {
    const ui::Theme& theme = m_ui.theme();

    configure_all_styles([&theme](ui::Style& style) {
        style.color(theme.text_color)
            .background_color(theme.control_background_color)
            .border_color(theme.control_border_color, 0.15F)
            .padding({10.0F, 6.0F})
            .border(ui::BORDER_ALL)
            .border_radius(theme.control_rounding)
            .border_thickness(theme.control_border_thickness);
    });

    configure_style(ui::StyleType::HOVER, [&theme](ui::Style& style) { style.border_color(theme.accent_hover_color); });
    configure_style(ui::StyleType::ACTIVE, [&theme](ui::Style& style) { style.border_color(theme.accent_color); });

    ImFont* value_font = m_ui.get_secondary_font(13);
    const auto configure_thumb = [&theme](AppRangeThumbNode& thumb) {
        thumb.configure_all_styles([&theme](ui::Style& style) {
            style.color(theme.background_color).background_color(theme.text_color).border_radius(theme.control_rounding);
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

bool RangeWidget::changed() const {
    return m_changed;
}

ui::Widget& RangeWidget::minimum_thumb() {
    return *m_minimum_thumb;
}

ui::Widget& RangeWidget::maximum_thumb() {
    return *m_maximum_thumb;
}

void RangeWidget::draw_children() {
    // thumbs are drawn after the track resolves their rectangles.
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
        m_minimum_active = std::abs(ImGui::GetMousePos().x - minimum_x) <= std::abs(ImGui::GetMousePos().x - maximum_x);
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

void RangeWidget::draw_track(ui::Rect track, float minimum_x, float maximum_x, float thumb_width) {
    const ui::Style& current_style = style();
    ImDrawList* draw_list = ImGui::GetWindowDrawList();

    ui::draw_frame(track, current_style);
    draw_list->AddRectFilled(
        {minimum_x, track.min.y}, {maximum_x, track.max.y}, ImGui::GetColorU32(m_ui.theme().accent_color),
        current_style.border_radius()
    );

    const float thumb_half = thumb_width * 0.5F;
    const ImVec2 thumb_size = {thumb_width, track.size().y};
    m_minimum_thumb->set_data(ui::Rect::from_position_size({minimum_x - thumb_half, track.min.y}, thumb_size), *m_minimum);
    m_maximum_thumb->set_data(ui::Rect::from_position_size({maximum_x - thumb_half, track.min.y}, thumb_size), *m_maximum);
    m_minimum_thumb->draw();
    m_maximum_thumb->draw();
}

bool RangeWidget::on_draw() {
    normalize_values();

    const float label_height = m_label.empty() ? 0.0F : ImGui::GetTextLineHeightWithSpacing();
    const float height = std::max(0.0F, layout().size().y - label_height);
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
    minimum_x = value_position(*m_minimum, value_track_start, value_track_width);
    maximum_x = value_position(*m_maximum, value_track_start, value_track_width);
    draw_track({track_min, track_max}, minimum_x, maximum_x, thumb_width);

    const ui::ItemInputState input = m_ui.input().observe(*this);
    ImGui::PopID();
    apply_input_state(input);
    return true;
}
