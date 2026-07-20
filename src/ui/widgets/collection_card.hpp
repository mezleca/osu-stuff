#pragma once

#include "widget.hpp"

#include <functional>

class IconTexture;

struct CollectionCardState : public WidgetState {
    explicit CollectionCardState();

    ImVec2 m_size = {150, 50};
    ImFont* m_font;
    ImFont* m_font_small;

    bool m_focused = false;
    bool m_selected = false;
};

class CollectionCardWidget : public UIWidget {
public:
    explicit CollectionCardWidget(UI* ui, std::string name, IconTexture* icon = nullptr);

    void show();

    CollectionCardState m_state;
    UIText<std::string> m_name;
    UIText<std::string> m_count;
    std::function<void()> m_onclick;
    std::function<void()> m_oncontext;
    IconTexture* m_icon = nullptr;
};
