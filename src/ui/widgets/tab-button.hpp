#pragma once

#include <imgui-ui/widgets/widget.hpp>
#include <imgui-ui/widgets/text-value.hpp>

class TabButtonWidget : public ui::Widget {
public:
    TabButtonWidget(std::string name, bool draw_line = true, bool is_title = false);

    void set_selected(bool value);

    bool is_selected() const {
        return m_selected;
    }

    ui::GenericValue m_name;

private:
    void apply_theme_defaults(const ui::Theme& theme) override;
    bool paint() override;
    void on_measure() override;
    void input_state_changed() override;

    bool m_draw_line = true;
    bool m_title = false;
    bool m_selected = false;
};
