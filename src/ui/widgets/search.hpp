#pragma once

#include "widget.hpp"

class IconTexture;

struct SearchInputState : public WidgetState {
    explicit SearchInputState();

    ImVec2 m_size = {120, 30};
    bool m_focused = false;
    bool m_fit_width = false;
};

class SearchInputWidget : public UIWidget {
public:
    explicit SearchInputWidget(UI* ui, std::string& value, IconTexture* icon = nullptr);

    void show();

    SearchInputState m_state;
    UITextFormatted<void*> m_label;
    std::string* m_value;
    IconTexture* m_icon = nullptr;
};
