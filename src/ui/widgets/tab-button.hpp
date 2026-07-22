#include "base/widget.hpp"
#include "base/text.hpp"

#include <functional>

class IconTexture;

class TabButtonWidget : public UIWidget {
public:
    explicit TabButtonWidget(std::string name, bool draw_line = true, bool is_title = false);

    void show() override;

    void set_selected(bool value) {
        m_selected = value;
    }

    bool is_selected() const {
        return m_selected;
    }

    UIText<std::string> m_name;
    std::function<void()> m_onclick;

private:
    bool m_draw_line = true;
    bool m_selected = false;
};
