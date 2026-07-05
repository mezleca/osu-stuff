#include "widget.hpp"
#include "../theme.hpp"

#include <functional>

struct IconTexture;
struct UI;

struct TabButtonStyle : WidgetStyle {
    AnimatedFloat m_line_alpha;
    AnimatedFloat m_line_width;
    AnimatedColor m_text_color = {ui_theme::TEXT_COLOR};
};

struct TabButtonState : WidgetStyle {
    TabButtonStyle m_style;

    bool m_draw_line = true;
    bool m_is_title = false;
};

struct TabButtonWidget : public UIWidget {
    explicit TabButtonWidget(UI* ui, std::string name, bool is_title = false, IconTexture* texture = nullptr);

    void show(bool selected);

    TabButtonState m_state = {};
    UICachedText<std::string> m_name;
    std::function<void()> on_click;
    IconTexture* m_icon = nullptr;
};
