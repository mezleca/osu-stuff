#include "widget.hpp"

#include <functional>

struct IconTexture;
struct UI;

struct TabButtonState : public WidgetState {
    explicit TabButtonState();

    bool m_draw_line = true;
    bool m_is_title = false;
};

struct TabButtonWidget : public UIWidget {
    explicit TabButtonWidget(UI* ui, std::string name, bool is_title = false, IconTexture* texture = nullptr);

    void show(bool selected);

    TabButtonState m_state;
    UIText<std::string> m_name;
    std::function<void()> on_click;
    IconTexture* m_icon = nullptr;
};
