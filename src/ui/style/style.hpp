#pragma once

#include "theme.hpp"
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
        Style() : m_padding({}) {
            const Theme theme = Theme::defaults();
            m_color.set(theme.text_color);
            m_border_color.set(theme.border_color);
            m_background_color.set(theme.transparent);
        }

        [[nodiscard]] ImFont* font() const {
            return m_font;
        }

        Style& font(ImFont* value) {
            m_font = value;
            return *this;
        }

        [[nodiscard]] const ImVec2& padding() const {
            return m_padding;
        }

        ImVec2& padding() {
            return m_padding;
        }

        Style& padding(ImVec2 value) {
            m_padding = value;
            return *this;
        }

        [[nodiscard]] float alpha() const {
            return m_alpha;
        }

        float& alpha() {
            return m_alpha;
        }

        Style& alpha(float value) {
            m_alpha = value;
            return *this;
        }

        [[nodiscard]] const ColorValue& color() const {
            return m_color;
        }

        ColorValue& color() {
            return m_color;
        }

        Style& color(ImColor value, float transition_speed = -1.0F) {
            m_color.set(value);
            if (transition_speed >= 0.0F) m_color.set_speed(transition_speed);
            return *this;
        }

        [[nodiscard]] const ColorValue& border_color() const {
            return m_border_color;
        }

        ColorValue& border_color() {
            return m_border_color;
        }

        Style& border_color(ImColor value, float transition_speed = -1.0F) {
            m_border_color.set(value);
            if (transition_speed >= 0.0F) m_border_color.set_speed(transition_speed);
            return *this;
        }

        [[nodiscard]] const ColorValue& background_color() const {
            return m_background_color;
        }

        ColorValue& background_color() {
            return m_background_color;
        }

        Style& background_color(ImColor value, float transition_speed = -1.0F) {
            m_background_color.set(value);
            if (transition_speed >= 0.0F) m_background_color.set_speed(transition_speed);
            return *this;
        }

        [[nodiscard]] float border_radius() const {
            return m_border_radius;
        }

        float& border_radius() {
            return m_border_radius;
        }

        Style& border_radius(float value) {
            m_border_radius = value;
            return *this;
        }

        [[nodiscard]] float border_thickness() const {
            return m_border_thickness;
        }

        float& border_thickness() {
            return m_border_thickness;
        }

        Style& border_thickness(float value) {
            m_border_thickness = value;
            return *this;
        }

        [[nodiscard]] uint8_t border() const {
            return m_border;
        }

        uint8_t& border() {
            return m_border;
        }

        Style& border(uint8_t value) {
            m_border = value;
            return *this;
        }

        /// custom animated values used by application-specific widgets.
        [[nodiscard]] StyleVariableStore& variables() {
            return m_vars;
        }

        [[nodiscard]] const StyleVariableStore& variables() const {
            return m_vars;
        }

        /// advances continuous values in `style` towards `target` by one frame.
        static void lerp(Style& style, const Style& target, float dt) {
            style.m_font = target.m_font;
            style.m_padding = target.m_padding;
            style.m_alpha = target.m_alpha;
            style.m_border_thickness = target.m_border_thickness;
            style.m_border_radius = target.m_border_radius;
            style.m_border = target.m_border;
            style.m_color.tick(target.m_color, dt);
            style.m_border_color.tick(target.m_border_color, dt);
            style.m_background_color.tick(target.m_background_color, dt);

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
            if (m_font == nullptr) {
                m_font = target.m_font;
            }

            target.m_vars.for_each([&](const std::string& key, const GenericValue& target_value) {
                if (m_vars.find(key) == nullptr) m_vars.set(key, target_value);
                return true;
            });
        }

        bool is_close_to(const Style& target, float epsilon) const {
            if (m_font != target.m_font || m_padding.x != target.m_padding.x || m_padding.y != target.m_padding.y ||
                std::abs(m_alpha - target.m_alpha) > epsilon || m_border != target.m_border ||
                std::abs(m_border_thickness - target.m_border_thickness) > epsilon ||
                std::abs(m_border_radius - target.m_border_radius) > epsilon) {
                return false;
            }

            if (!m_color.is_close(target.m_color, epsilon) ||
                !m_border_color.is_close(target.m_border_color, epsilon) ||
                !m_background_color.is_close(target.m_background_color, epsilon)) {
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
        ImFont* m_font = nullptr;
        ImVec2 m_padding = {};
        float m_alpha = 1.0F;
        float m_border_thickness = 1.0F;
        float m_border_radius = 4.0F;
        ColorValue m_color;
        ColorValue m_border_color;
        ColorValue m_background_color;
        uint8_t m_border = BORDER_NONE;
        StyleVariableStore m_vars;
    };

} // namespace ui
