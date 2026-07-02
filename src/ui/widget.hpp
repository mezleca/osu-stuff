#pragma once

#include <imgui.h>

struct AnimatedFloat {
    float value = 0.0f;

    void tick(float target, float speed, float dt);
    void set(float new_value);
};

struct AnimatedColor {
    ImVec4 value = {};

    void tick(ImVec4 target, float speed, float dt);
    void set(ImVec4 new_value);
};

struct WidgetStyle {
    bool visible = true;
    AnimatedFloat alpha;

    void tick(float speed, float dt);
    [[nodiscard]] bool is_hidden() const;
};
