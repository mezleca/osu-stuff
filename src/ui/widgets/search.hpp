#pragma once

#include "base/widget.hpp"
#include "base/text.hpp"
#include "image.hpp"

class IconTexture;

class SearchInputWidget : public UIWidget {
public:
    explicit SearchInputWidget(std::string& value);

    void show();
    void set_fit_width(bool value);

    UITextFormatted<void*> m_label;
    std::string* m_value;
    UIImageWidget m_icon;

private:
    ImVec2 m_size = {120.0f, 30.0f};
    bool m_fit_width = false;
};
