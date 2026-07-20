#include "widget.hpp"

#include <functional>

class IconTexture;
class UI;

struct TabButtonState : public WidgetState {
    explicit TabButtonState();

    bool m_draw_line = true;
    bool m_is_title = false;
};

class TabButtonWidget : public UIWidget {
public:
    explicit TabButtonWidget(UI* ui, std::string name, bool is_title = false, IconTexture* texture = nullptr);

    void show(bool selected);

    TabButtonState m_state;
    UIText<std::string> m_name;
    std::function<void()> m_onclick;
    IconTexture* m_icon = nullptr;
};
