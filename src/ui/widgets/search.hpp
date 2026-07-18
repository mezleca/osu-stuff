#include "widget.hpp"

struct IconTexture;

struct SearchInputState : public WidgetState {
    explicit SearchInputState();

    std::string m_value = "";
    ImVec2 m_size = {120, 30};
    bool m_focused = false;
    bool m_fit_width = false;
};

struct SearchInputWidget : public UIWidget {
    explicit SearchInputWidget(UI* ui, IconTexture* icon = nullptr);

    void show();

    SearchInputState m_state;
    UITextFormatted<void*> m_label;
    IconTexture* m_icon = nullptr;
};
