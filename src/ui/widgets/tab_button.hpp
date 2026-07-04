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

    std::string m_label = "unknown";

    bool m_draw_line = true;
    bool m_is_title = false;
};

struct TabButtonWidget : public UIWidget {
    explicit TabButtonWidget(UI* ui, std::string_view name, bool is_title = false, IconTexture* texture = nullptr);

    void show(bool selected);

    TabButtonState m_state = {};
    std::function<void(std::string)> on_click;

    IconTexture* m_icon = nullptr;
};
