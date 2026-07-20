#pragma once

#include "../../../utils/math.hpp"

#include <cmath>
#include <string>
#include <utility>
#include <variant>
#include <imgui.h>

template <typename ValueT>
struct UIWidgetValue {
    ValueT value{};
    float speed = 0.0f;

    void set(ValueT new_value) {
        value = std::move(new_value);
    }

    void set_speed(float new_speed) {
        speed = new_speed;
    }
};

struct UIWidgetFloat : UIWidgetValue<float> {
    void tick(const UIWidgetFloat& target, float dt) {
        value = target.speed > 0.0f ? math_utils::exp_lerp(value, target.value, target.speed, dt) : target.value;
    }

    bool is_close(const UIWidgetFloat& target, float epsilon) const {
        return std::fabs(value - target.value) <= epsilon;
    }
};

struct UIWidgetColor : UIWidgetValue<ImColor> {
    void tick(const UIWidgetColor& target, float dt) {
        if (target.speed <= 0.0f) {
            value = target.value;
            return;
        }

        ImVec4 col = value.Value;
        const ImVec4& target_col = target.value.Value;

        col.x = math_utils::exp_lerp(col.x, target_col.x, target.speed, dt);
        col.y = math_utils::exp_lerp(col.y, target_col.y, target.speed, dt);
        col.z = math_utils::exp_lerp(col.z, target_col.z, target.speed, dt);
        col.w = math_utils::exp_lerp(col.w, target_col.w, target.speed, dt);

        value.Value = col;
    }

    bool is_close(const UIWidgetColor& target, float epsilon) const {
        const ImVec4& col = value.Value;
        const ImVec4& target_col = target.value.Value;

        return std::fabs(col.x - target_col.x) <= epsilon && std::fabs(col.y - target_col.y) <= epsilon &&
               std::fabs(col.z - target_col.z) <= epsilon && std::fabs(col.w - target_col.w) <= epsilon;
    }

    ImVec4 get() const {
        return value.Value;
    }
};

struct UIWidgetVec2 : UIWidgetValue<ImVec2> {
    void tick(const UIWidgetVec2& target, float dt) {
        if (target.speed <= 0.0f) {
            value = target.value;
            return;
        }

        value.x = math_utils::exp_lerp(value.x, target.value.x, target.speed, dt);
        value.y = math_utils::exp_lerp(value.y, target.value.y, target.speed, dt);
    }

    bool is_close(const UIWidgetVec2& target, float epsilon) const {
        return std::fabs(value.x - target.value.x) <= epsilon && std::fabs(value.y - target.value.y) <= epsilon;
    }
};

struct UIWidgetInt : UIWidgetValue<int> {
    void tick(const UIWidgetInt& target, float dt) {
        if (target.speed <= 0.0f) {
            value = target.value;
            return;
        }

        float interpolated =
            math_utils::exp_lerp(static_cast<float>(value), static_cast<float>(target.value), target.speed, dt);

        if (target.value > value) {
            value = static_cast<int>(std::ceil(interpolated));
        } else if (target.value < value) {
            value = static_cast<int>(std::floor(interpolated));
        }
    }

    bool is_close(const UIWidgetInt& target, float epsilon) const {
        return std::abs(value - target.value) <= epsilon;
    }
};

struct UIWidgetBool : UIWidgetValue<bool> {
    void tick(const UIWidgetBool& target, float) {
        value = target.value;
    }

    bool is_close(const UIWidgetBool&, float) const {
        return true;
    }
};

struct UIWidgetString : UIWidgetValue<std::string> {
    void tick(const UIWidgetString& target, float) {
        value = target.value;
    }

    bool is_close(const UIWidgetString&, float) const {
        return true;
    }
};

using GenericValue =
    std::variant<UIWidgetInt, UIWidgetFloat, UIWidgetString, UIWidgetBool, UIWidgetColor, UIWidgetVec2>;
