#pragma once

#include "widget_values.hpp"

#include <cstdint>
#include <functional>
#include <string>
#include <string_view>
#include <type_traits>
#include <unordered_map>
#include <utility>
#include <variant>

enum class WidgetStyleType : int32_t {
    DEFAULT = 0,
    HOVER = 1,
    ACTIVE,
    FOCUS,
    _COUNT
};

struct StyleVariableHash {
    using is_transparent = void;

    [[nodiscard]] size_t operator()(std::string_view value) const {
        return std::hash<std::string_view>{}(value);
    }

    [[nodiscard]] size_t operator()(const std::string& value) const {
        return operator()(std::string_view{value});
    }
};

class StyleVariableStore {
public:
    void set(std::string_view key, GenericValue value) {
        auto existing_it = m_vars.find(key);

        if (existing_it != m_vars.end()) {
            existing_it->second = std::move(value);
            return;
        }

        m_vars.emplace(key, std::move(value));
    }

    template <typename T>
    void set(std::string_view key, T value) {
        set(key, GenericValue{std::move(value)});
    }

    template <typename T>
    [[nodiscard]] T* get(std::string_view key) {
        auto value_it = m_vars.find(key);

        if (value_it == m_vars.end()) {
            return nullptr;
        }

        return std::get_if<T>(&value_it->second);
    }

    template <typename T>
    [[nodiscard]] const T* get(std::string_view key) const {
        auto value_it = m_vars.find(key);

        if (value_it == m_vars.end()) {
            return nullptr;
        }

        return std::get_if<T>(&value_it->second);
    }

    [[nodiscard]] GenericValue* find(std::string_view key) {
        auto value_it = m_vars.find(key);
        return value_it == m_vars.end() ? nullptr : &value_it->second;
    }

    [[nodiscard]] const GenericValue* find(std::string_view key) const {
        auto value_it = m_vars.find(key);
        return value_it == m_vars.end() ? nullptr : &value_it->second;
    }

    template <typename Func>
    bool for_each(Func&& func) {
        static_assert(
            std::is_invocable_r_v<bool, Func&, const std::string&, GenericValue&>,
            "StyleVariableStore::for_each callback must return bool"
        );

        for (auto& [key, value] : m_vars) {
            if (!std::invoke(func, key, value)) {
                return false;
            }
        }

        return true;
    }

    template <typename Func>
    bool for_each(Func&& func) const {
        static_assert(
            std::is_invocable_r_v<bool, Func&, const std::string&, const GenericValue&>,
            "StyleVariableStore::for_each callback must return bool"
        );

        for (const auto& [key, value] : m_vars) {
            if (!std::invoke(func, key, value)) {
                return false;
            }
        }

        return true;
    }

private:
    std::unordered_map<std::string, GenericValue, StyleVariableHash, std::equal_to<>> m_vars;
};

class WidgetStyle {
public:
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

    static void lerp(WidgetStyle& style, const WidgetStyle& target, float dt) {
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

    void adopt_missing_keys_from(const WidgetStyle& target) {
        target.m_vars.for_each([&](const std::string& key, const GenericValue& target_value) {
            if (m_vars.find(key) == nullptr) {
                m_vars.set(key, target_value);
            }

            return true;
        });
    }

    bool is_close_to(const WidgetStyle& target, float epsilon) const {
        if (!color.is_close(target.color, epsilon)) {
            return false;
        }

        if (!border_color.is_close(target.border_color, epsilon)) {
            return false;
        }

        if (!background_color.is_close(target.background_color, epsilon)) {
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

struct StyleTransitionData {
    float elapsed = 0.0f;

    WidgetStyleType from = WidgetStyleType::DEFAULT;
    WidgetStyleType to = WidgetStyleType::DEFAULT;

    bool done = true;

    void start(WidgetStyleType new_from, WidgetStyleType new_to) {
        from = new_from;
        to = new_to;
        elapsed = 0.0f;
        done = false;
    }

    void end() {
        from = to;
        elapsed = 0.0f;
        done = true;
    }
};

class WidgetState {
public:
    static constexpr float OPACITY_TRANSITION_SPEED = 12.0f;
    static constexpr float TRANSITION_SETTLE_EPSILON = 0.002f;
    static constexpr float VISIBILITY_OPACITY_THRESHOLD = 0.001f;

    WidgetState() {
        current_opacity.value = opacity;
    }

    void snap_to_style(WidgetStyleType type) {
        current_style = styles[static_cast<size_t>(type)];
        transition_data.from = type;
        transition_data.to = type;
        transition_data.elapsed = 0.0f;
        transition_data.done = true;
    }

    [[nodiscard]] bool is_visible() const {
        return visible &&
               (opacity >= VISIBILITY_OPACITY_THRESHOLD || current_opacity.value >= VISIBILITY_OPACITY_THRESHOLD);
    }

    void set_visible(bool value) {
        visible = value;
    }

    void set_opacity(float value) {
        opacity = value;
    }

    float get_opacity() const {
        return current_opacity.value;
    }

    void update(float dt) {
        current_opacity.tick(UIWidgetFloat{opacity, OPACITY_TRANSITION_SPEED}, dt);

        if (transition_data.done) {
            return;
        }

        const WidgetStyle& to = styles[static_cast<size_t>(transition_data.to)];

        transition_data.elapsed += dt;
        WidgetStyle::lerp(current_style, to, dt);

        if (current_style.is_close_to(to, TRANSITION_SETTLE_EPSILON)) {
            transition_data.end();
        }
    }

    void set_style(WidgetStyleType type) {
        if (transition_data.to == type) {
            return;
        }

        current_style.adopt_missing_keys_from(styles[static_cast<size_t>(type)]);
        transition_data.start(transition_data.to, type);
    }

    template <typename Func>
    void set_for_all_styles(Func&& func) {
        for (auto& style : styles) {
            func(style);
        }
    }

    WidgetStyleType get_style_type() const {
        return transition_data.to;
    }

    WidgetStyle& get_style() {
        return current_style;
    }

    WidgetStyle& get_style(WidgetStyleType type) {
        return styles[static_cast<size_t>(type)];
    }

private:
    StyleTransitionData transition_data;

    float opacity = 1.0f;
    UIWidgetFloat current_opacity;

    WidgetStyle styles[static_cast<size_t>(WidgetStyleType::_COUNT)];
    WidgetStyle current_style;

    bool visible = true;
};
