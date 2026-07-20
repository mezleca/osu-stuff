#pragma once

#include "../object.hpp"

#include <imgui.h>

class IconTexture;

class UIImageWidget : public UIObject {
public:
    explicit UIImageWidget(IconTexture* texture = nullptr) : m_texture(texture) {
    }

    void set_texture(IconTexture* texture) {
        m_texture = texture;
    }

    void set_size(ImVec2 size) {
        m_size = size;
    }

    void set_color(ImColor color) {
        m_color = color;
    }

    void show() override;

private:
    IconTexture* m_texture = nullptr;
    ImVec2 m_size = {0.0f, 0.0f};
    ImColor m_color = ImColor(255, 255, 255, 255);
};
