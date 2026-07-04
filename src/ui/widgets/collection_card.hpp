#include "widget.hpp"
#include "../theme.hpp"

#include <functional>

struct IconTexture;

struct CollectionCardStyle : WidgetStyle {
    AnimatedColor m_border_color = {ui_theme::TRANSPARENT};
    AnimatedColor m_bg_color = {ui_theme::TRANSPARENT};

    ImColor m_text_color = ui_theme::TEXT_COLOR;
    ImColor m_icon_color = ui_theme::ACCENT_COLOR;
};

struct CollectionCardState : WidgetStyle {
    CollectionCardStyle m_style;

    // data
    std::string m_name = "unknown";
    std::string m_count = "0 maps";

    // animated stuff
    CollectionCardStyle style;

    ImVec2 m_size = {150, 50};
    ImFont* m_font;
    ImFont* m_font_small;

    bool m_focused = false;
    bool m_selected = false;
};

struct CollectionCardWidget : public UIWidget {
    explicit CollectionCardWidget(UI* ui, std::string name, IconTexture* icon = nullptr);

    void show();

    CollectionCardState m_state = {};

    std::function<void()> on_click;
    std::function<void()> on_context;

    IconTexture* m_icon = nullptr;
};
