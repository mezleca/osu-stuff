#pragma once

#include "base/widget.hpp"
#include "base/text.hpp"

#include <imgui.h>
#include <functional>

class UIButtonWidget : public UIWidget {
public:
    UIButtonWidget(std::string text, ImVec2 size = {100.0f, 60.0f});

    void show() override;

    std::function<void()> on_click;

private:
    UIText<std::string> m_text;
    ImVec2 m_size;
};
