#include "widget.hpp"
#include "../theme.hpp"

struct IconTexture;

struct SearchInputStyle : WidgetStyle {
    AnimatedColor m_border_color = {ui_theme::BORDER_COLOR};

    ImColor m_text_color = {240, 240, 240, 255};
    ImColor m_icon_color = {120, 120, 120, 255};
};

struct SearchInputState : WidgetStyle {
    // data
    FormattedText<void*> m_label{"##{}-search-input"};
    std::string m_value = "";

    // animated stuff
    SearchInputStyle style;

    ImVec2 m_size = {120, 30};

    bool m_focused = false;
    bool m_fit_width = false;
};

struct SearchInputWidget : public UIWidget {
    explicit SearchInputWidget(UI* ui, IconTexture* icon = nullptr);

    void show();

    SearchInputState m_state = {};
    IconTexture* m_icon = nullptr;
};
