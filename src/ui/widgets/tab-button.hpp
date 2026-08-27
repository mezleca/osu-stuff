#pragma once

#include <ui/widgets/widget.hpp>
#include <ui/widgets/text-value.hpp>

class IconTexture;
class UI;

namespace app {

    class TabButtonWidget : public ui::Widget {
    public:
        TabButtonWidget(UI& ui, std::string name, bool draw_line = true, bool is_title = false);

        [[nodiscard]] bool on_draw() override;

        [[nodiscard]] std::optional<std::string> content() const override;
        bool try_set_content(std::string content) override;

        void set_selected(bool value) {
            m_selected = value;
        }

        bool is_selected() const {
            return m_selected;
        }

        ui::GenericValue m_name;

    private:
        void on_measure() override;

        UI& m_ui;
        bool m_draw_line = true;
        bool m_title = false;
        bool m_selected = false;
    };

} // namespace app
