#pragma once

#include "variables.hpp"

#include <cstdint>
#include <string_view>
#include <type_traits>
#include <utility>
#include <variant>

enum UIObjectBorder : uint8_t {
    UI_BORDER_NONE = 0,
    UI_BORDER_LEFT = 1 << 0,
    UI_BORDER_TOP = 1 << 1,
    UI_BORDER_RIGHT = 1 << 2,
    UI_BORDER_BOTTOM = 1 << 3,
    UI_BORDER_ALL = 1 << 4,
};

enum class UIStyleType : int32_t {
    DEFAULT = 0,
    HOVER = 1,
    ACTIVE,
    FOCUS,
    _COUNT
};

class UIStyle {
public:
    uint8_t border = UI_BORDER_NONE;
    float border_thickness = 1.0f;
    ImFont* font = nullptr;
    UIWidgetColor color;
    UIWidgetColor border_color;
    UIWidgetColor background_color;

    template <typename T>
    void set_variable(std::string_view key, T value) {
        m_vars.set(key, std::move(value));
    }

    [[nodiscard]] StyleVariableStore& variables() {
        return m_vars;
    }

    [[nodiscard]] const StyleVariableStore& variables() const {
        return m_vars;
    }

    static void lerp(UIStyle& style, const UIStyle& target, float dt) {
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

    void adopt_missing_keys_from(const UIStyle& target) {
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

    bool is_close_to(const UIStyle& target, float epsilon) const {
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
