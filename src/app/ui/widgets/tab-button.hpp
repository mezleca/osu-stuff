#pragma once

#include "../../../ui/widgets/base/widget.hpp"
#include "../../../ui/widgets/base/text.hpp"

class IconTexture;

class TabButtonWidget : public ui::Widget {
public:
    explicit TabButtonWidget(std::string name, bool draw_line = true, bool is_title = false);

    void on_draw() override;

    [[nodiscard]] std::optional<std::string> get_content() const override;
    bool set_content(std::string content) override;

    void set_selected(bool value) {
        m_selected = value;
    }

    bool is_selected() const {
        return m_selected;
    }

    ui::TextValue<std::string> m_name;

private:
    bool m_draw_line = true;
    bool m_selected = false;
};
