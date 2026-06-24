#include "widget.hpp"
#include "../utils/math.hpp"

static constexpr float HIDDEN_ALPHA_THRESHOLD = 0.001f;

void AnimatedFloat::tick(float target, float speed, float dt) {
    value = math_utils::exp_lerp(value, target, speed, dt);
}

void AnimatedFloat::set(float new_value) {
    value = new_value;
}

void AnimatedColor::tick(ImVec4 target, float speed, float dt) {
    value.x = math_utils::exp_lerp(value.x, target.x, speed, dt);
    value.y = math_utils::exp_lerp(value.y, target.y, speed, dt);
    value.z = math_utils::exp_lerp(value.z, target.z, speed, dt);
    value.w = math_utils::exp_lerp(value.w, target.w, speed, dt);
}

void AnimatedColor::set(ImVec4 new_value) {
    value = new_value;
}

void WidgetState::tick(float speed, float dt) {
    alpha.tick(visible ? 1.0f : 0.0f, speed, dt);
}

bool WidgetState::is_hidden() const {
    return !visible && alpha.value <= HIDDEN_ALPHA_THRESHOLD;
}
