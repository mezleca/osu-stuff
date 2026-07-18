#include "widget.hpp"

#include <functional>

struct IconTexture;

struct CollectionCardState : public WidgetState {
    explicit CollectionCardState();

    ImVec2 m_size = {150, 50};
    ImFont* m_font;
    ImFont* m_font_small;

    bool m_focused = false;
    bool m_selected = false;
};

struct CollectionCardWidget : public UIWidget {
    explicit CollectionCardWidget(UI* ui, std::string name, IconTexture* icon = nullptr);

    void show();

    CollectionCardState m_state;
    UIText<std::string> m_name;
    UIText<std::string> m_count;
    std::function<void()> on_click;
    std::function<void()> on_context;
    IconTexture* m_icon = nullptr;
};
