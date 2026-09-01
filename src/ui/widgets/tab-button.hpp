#pragma once

#include <ui/widgets/widget.hpp>
#include <ui/widgets/text-value.hpp>

class IconTexture;
class UI;

namespace app {

    class TabButtonWidget : public ui::Widget {
    public:
        TabButtonWidget(UI& ui, std::string name, bool draw_line = true, bool is_title = false);

        void set_selected(bool value) {
            if (m_selected == value) {
                return;
            }

            m_selected = value;
            if (!m_selected) {
                const ui::InputState& input = input_state();
                set_interaction_style(input.hovered, input.active, input.focused);
            }
        }

        bool is_selected() const {
            return m_selected;
        }

        ui::GenericValue m_name;

    private:
        bool paint() override;
        void on_measure() override;

        UI& m_ui;
        bool m_draw_line = true;
        bool m_title = false;
        bool m_selected = false;
    };

} // namespace app
