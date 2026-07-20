#pragma once

#include "base/widget.hpp"
#include "base/text.hpp"
#include "image.hpp"

#include <functional>

class IconTexture;

class CollectionCardWidget : public UIWidget {
public:
    explicit CollectionCardWidget(std::string name, IconTexture* icon = nullptr);

    void show();
    void set_selected(bool value);
    void toggle_selected();
    [[nodiscard]] bool is_selected() const;

    UIText<std::string> m_name;
    UIText<std::string> m_count;
    std::function<void()> m_onclick;
    std::function<void()> m_oncontext;
    IconTexture* m_icon = nullptr;
    UIImageWidget m_icon_image;

private:
    ImVec2 m_size = {150.0f, 50.0f};
    ImFont* m_font_small = nullptr;
    bool m_selected = false;
};
