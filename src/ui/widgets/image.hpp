#pragma once

#include "base/widget.hpp"

#include <imgui.h>

class IconTexture;

class UIImageWidget : public UIWidget {
public:
    explicit UIImageWidget(IconTexture* texture = nullptr);

    void set_texture(IconTexture* texture) {
        m_texture = texture;
    }

    void set_size(ImVec2 size) {
        m_size = size;
    }

    ImVec2 get_size() const {
        return m_size;
    }

    void show() override;

private:
    IconTexture* m_texture = nullptr;
    ImVec2 m_size = {0.0f, 0.0f};
};
