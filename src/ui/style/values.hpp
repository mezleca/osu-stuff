#pragma once

#include "../../utils/math.hpp"

#include <algorithm>
#include <cmath>
#include <string>
#include <variant>
#include <imgui.h>

namespace ui {
    [[nodiscard]] inline ImColor with_alpha(ImColor color, float alpha) {
        color.Value.w = std::clamp(alpha, 0.0F, 1.0F);
        return color;
    }

    template <typename T>
    struct Value {
        T value{};
        float speed = 0.0f;

        void set(T new_value) {
            value = new_value;
        }

        void set_speed(float new_speed) {
            speed = new_speed;
        }
    };

    struct FloatValue : Value<float> {
        void tick(const FloatValue& target, float dt) {
            value = target.speed > 0.0f ? math_utils::exp_lerp(value, target.value, target.speed, dt) : target.value;
        }

        bool is_close(const FloatValue& target, float epsilon) const {
            return std::fabs(value - target.value) <= epsilon;
        }
    };

    struct ColorValue : Value<ImColor> {
        void tick(const ColorValue& target, float dt) {
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

        bool is_close(const ColorValue& target, float epsilon) const {
            const ImVec4& col = value.Value;
            const ImVec4& target_col = target.value.Value;

            return std::fabs(col.x - target_col.x) <= epsilon && std::fabs(col.y - target_col.y) <= epsilon &&
                   std::fabs(col.z - target_col.z) <= epsilon && std::fabs(col.w - target_col.w) <= epsilon;
        }

        ImVec4 get() const {
            return value.Value;
        }

        ImU32 get_col() const {
            return ImGui::GetColorU32(value.Value);
        }
    };

    struct Vec2Value : Value<ImVec2> {
        void tick(const Vec2Value& target, float dt) {
            if (target.speed <= 0.0f) {
                value = target.value;
                return;
            }

            value.x = math_utils::exp_lerp(value.x, target.value.x, target.speed, dt);
            value.y = math_utils::exp_lerp(value.y, target.value.y, target.speed, dt);
        }

        bool is_close(const Vec2Value& target, float epsilon) const {
            return std::fabs(value.x - target.value.x) <= epsilon && std::fabs(value.y - target.value.y) <= epsilon;
        }
    };

    struct IntValue : Value<int> {
        void tick(const IntValue& target, float dt) {
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

        bool is_close(const IntValue& target, float epsilon) const {
            return std::abs(value - target.value) <= epsilon;
        }
    };

    struct BoolValue : Value<bool> {
        void tick(const BoolValue& target, float) {
            value = target.value;
        }

        bool is_close(const BoolValue&, float) const {
            return true;
        }
    };

    struct StringValue : Value<std::string> {
        void tick(const StringValue& target, float) {
            value = target.value;
        }

        bool is_close(const StringValue&, float) const {
            return true;
        }
    };

    using GenericValue = std::variant<IntValue, FloatValue, StringValue, BoolValue, ColorValue, Vec2Value>;

} // namespace ui
