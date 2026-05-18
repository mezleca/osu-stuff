#pragma once

#include "theme.hpp"

#include <string>
#include <string_view>
#include <unordered_map>

struct WidgetAnim {
    float value = 0.0f;
    float target = 0.0f;
    float speed = ui_theme::DEFAULT_ANIM_SPEED;
};

struct WidgetState {
  public:
    bool visible = true;
    std::unordered_map<std::string, WidgetAnim> anims;

    [[nodiscard]] float get_anim(std::string_view name, float fallback = 0.0f) const;
    void configure_anim(std::string_view name, float initial_value, float speed);
    void set_anim_target(std::string_view name, float target, float speed = ui_theme::DEFAULT_ANIM_SPEED);
    void set_anim_value(std::string_view name, float value);
    void tick();
    void show() {
        visible = true;
    }
    void hide() {
        visible = false;
    }
    [[nodiscard]] bool is_hidden(std::string_view alpha_name = "alpha") const {
        constexpr float HIDDEN_THRESHOLD = 0.001f;
        return !visible && get_anim(alpha_name) <= HIDDEN_THRESHOLD;
    }
};
