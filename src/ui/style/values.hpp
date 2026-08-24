#pragma once

#include "../../utils/math.hpp"

#include <algorithm>
#include <cmath>
#include <imgui.h>
#include <string>
#include <utility>
#include <variant>

namespace ui {
    template <typename T>
    [[nodiscard]] bool transition_values_equal(const T& left, const T& right) {
        return left == right;
    }

    [[nodiscard]] inline bool transition_values_equal(const ImVec2& left, const ImVec2& right) {
        return left.x == right.x && left.y == right.y;
    }

    [[nodiscard]] inline bool transition_values_equal(const ImColor& left, const ImColor& right) {
        return left.Value.x == right.Value.x && left.Value.y == right.Value.y && left.Value.z == right.Value.z &&
               left.Value.w == right.Value.w;
    }

    [[nodiscard]] inline ImColor with_alpha(ImColor color, float alpha) {
        color.Value.w = std::clamp(alpha, 0.0F, 1.0F);
        return color;
    }

    template <typename T>
    struct Value {
        Value() = default;
        Value(T initial_value, float transition_duration = 0.0F)
            : value(std::move(initial_value)), duration(std::max(0.0F, transition_duration)) {}

        T value{};
        float duration = 0.0F;

        void set(T new_value) {
            value = std::move(new_value);
            m_has_target = false;
        }

        void set_duration(float new_duration) {
            duration = std::max(0.0F, new_duration);
        }

    protected:
        [[nodiscard]] float transition_progress(const Value& target, float dt) {
            const float target_duration = std::max(0.0F, target.duration);
            const bool target_changed =
                !m_has_target || !transition_values_equal(m_target, target.value) || m_duration != target_duration;
            if (target_changed) {
                m_start = value;
                m_target = target.value;
                m_duration = target_duration;
                m_elapsed = 0.0F;
                m_has_target = true;
            }

            if (m_duration == 0.0F) {
                return 1.0F;
            }

            m_elapsed = std::min(m_duration, m_elapsed + std::max(0.0F, dt));
            return m_elapsed / m_duration;
        }

        [[nodiscard]] const T& transition_start() const {
            return m_start;
        }

    private:
        T m_start{};
        T m_target{};
        float m_duration = 0.0F;
        float m_elapsed = 0.0F;
        bool m_has_target = false;
    };

    struct FloatValue : Value<float> {
        using Value::Value;

        void tick(const FloatValue& target, float dt) {
            const float progress = transition_progress(target, dt);
            value = math_utils::lerp(transition_start(), target.value, progress);
        }

        bool is_close(const FloatValue& target, float epsilon) const {
            return std::fabs(value - target.value) <= epsilon;
        }
    };

    struct ColorValue : Value<ImColor> {
        using Value::Value;

        void tick(const ColorValue& target, float dt) {
            const float progress = transition_progress(target, dt);
            const ImVec4& start = transition_start().Value;
            const ImVec4& end = target.value.Value;

            value.Value = {
                math_utils::lerp(start.x, end.x, progress),
                math_utils::lerp(start.y, end.y, progress),
                math_utils::lerp(start.z, end.z, progress),
                math_utils::lerp(start.w, end.w, progress),
            };
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
        using Value::Value;

        void tick(const Vec2Value& target, float dt) {
            const float progress = transition_progress(target, dt);
            const ImVec2& start = transition_start();
            value = {
                math_utils::lerp(start.x, target.value.x, progress),
                math_utils::lerp(start.y, target.value.y, progress),
            };
        }

        bool is_close(const Vec2Value& target, float epsilon) const {
            return std::fabs(value.x - target.value.x) <= epsilon && std::fabs(value.y - target.value.y) <= epsilon;
        }
    };

    struct IntValue : Value<int> {
        using Value::Value;

        void tick(const IntValue& target, float dt) {
            const float progress = transition_progress(target, dt);
            value = static_cast<int>(std::lround(
                math_utils::lerp(static_cast<float>(transition_start()), static_cast<float>(target.value), progress)
            ));
        }

        bool is_close(const IntValue& target, float epsilon) const {
            return std::abs(value - target.value) <= epsilon;
        }
    };

    struct BoolValue : Value<bool> {
        using Value::Value;

        void tick(const BoolValue& target, float) {
            value = target.value;
        }

        bool is_close(const BoolValue&, float) const {
            return true;
        }
    };

    struct StringValue : Value<std::string> {
        using Value::Value;

        void tick(const StringValue& target, float) {
            value = target.value;
        }

        bool is_close(const StringValue&, float) const {
            return true;
        }
    };

    using GenericValue = std::variant<IntValue, FloatValue, StringValue, BoolValue, ColorValue, Vec2Value>;
} // namespace ui
