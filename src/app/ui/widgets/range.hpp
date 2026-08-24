#pragma once

#include <ui/widgets/widget.hpp>

#include <string>

class AppRangeThumbNode;
class UI;

class RangeWidget final : public ui::Widget {
public:
    RangeWidget(UI& ui, float& minimum, float& maximum, std::string id = {});

    RangeWidget& set_label(std::string label);
    RangeWidget& set_bounds(float minimum, float maximum);
    RangeWidget& set_step(float step);
    [[nodiscard]] bool changed() const;
    [[nodiscard]] ui::Widget& minimum_thumb();
    [[nodiscard]] ui::Widget& maximum_thumb();
    [[nodiscard]] bool on_draw() override;

private:
    void configure_default_styles();
    void normalize_values();
    void update_value_from_input(float track_start, float track_width, float minimum_x, float maximum_x);
    void draw_track(ui::Rect track, float minimum_x, float maximum_x, float thumb_width);
    void draw_children() override;
    [[nodiscard]] float value_position(float value, float track_start, float track_width) const;

    UI& m_ui;
    AppRangeThumbNode* m_minimum_thumb = nullptr;
    AppRangeThumbNode* m_maximum_thumb = nullptr;
    float* m_minimum;
    float* m_maximum;
    std::string m_label;
    float m_lower_bound = 0.0F;
    float m_upper_bound = 1.0F;
    float m_step = 0.1F;
    bool m_minimum_active = true;
    bool m_changed = false;
};
