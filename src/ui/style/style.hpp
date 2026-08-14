#pragma once

#include "variables.hpp"

#include <cstdint>
#include <cmath>
#include <type_traits>
#include <variant>

namespace ui {
    enum Border : uint8_t {
        BORDER_NONE = 0,
        BORDER_LEFT = 1 << 0,
        BORDER_TOP = 1 << 1,
        BORDER_RIGHT = 1 << 2,
        BORDER_BOTTOM = 1 << 3,
        BORDER_ALL = 1 << 4,
    };

    enum class StyleType : int32_t {
        DEFAULT = 0,
        HOVER = 1,
        ACTIVE,
        FOCUS,
        _COUNT
    };

    class Style {
    public:
        ImFont* font = nullptr;

        float border_thickness = 1.0f;
        float border_radius = 4.0f;

        ColorValue color;
        ColorValue border_color;
        ColorValue background_color;

        uint8_t border = BORDER_NONE;

        [[nodiscard]] StyleVariableStore& variables() {
            return m_vars;
        }

        [[nodiscard]] const StyleVariableStore& variables() const {
            return m_vars;
        }

        static void lerp(Style& style, const Style& target, float dt) {
            style.font = target.font;
            style.border_thickness = target.border_thickness;
            style.border_radius = target.border_radius;
            style.border = target.border;
            style.color.tick(target.color, dt);
            style.border_color.tick(target.border_color, dt);
            style.background_color.tick(target.background_color, dt);

            style.m_vars.for_each([&](const std::string& key, GenericValue& value) {
                const GenericValue* target_value = target.m_vars.find(key);
                if (target_value == nullptr) {
                    return true;
                }

                std::visit(
                    [&](auto& current_value) {
                        using T = std::decay_t<decltype(current_value)>;
                        if (const T* typed_target = std::get_if<T>(target_value)) {
                            current_value.tick(*typed_target, dt);
                        }
                    },
                    value
                );

                return true;
            });
        }

        void adopt_missing_keys_from(const Style& target) {
            if (font == nullptr) {
                font = target.font;
            }

            target.m_vars.for_each([&](const std::string& key, const GenericValue& target_value) {
                if (m_vars.find(key) == nullptr) {
                    m_vars.set(key, target_value);
                }
                return true;
            });
        }

        bool is_close_to(const Style& target, float epsilon) const {
            if (font != target.font || border != target.border ||
                std::abs(border_thickness - target.border_thickness) > epsilon ||
                std::abs(border_radius - target.border_radius) > epsilon) {
                return false;
            }

            if (!color.is_close(target.color, epsilon) || !border_color.is_close(target.border_color, epsilon) ||
                !background_color.is_close(target.background_color, epsilon)) {
                return false;
            }

            return m_vars.for_each([&](const std::string& key, const GenericValue& value) {
                const GenericValue* target_value = target.m_vars.find(key);
                if (target_value == nullptr) {
                    return true;
                }

                return std::visit(
                    [&](const auto& current_value) {
                        using T = std::decay_t<decltype(current_value)>;
                        const T* typed_target = std::get_if<T>(target_value);
                        return typed_target == nullptr || current_value.is_close(*typed_target, epsilon);
                    },
                    value
                );
            });
        }

    private:
        StyleVariableStore m_vars;
    };

} // namespace ui
