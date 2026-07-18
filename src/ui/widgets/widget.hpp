#pragma once

#include "../../utils/math.hpp"

#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <string>
#include <format>
#include <unordered_map>
#include <variant>
#include <optional>
#include <imgui.h>

enum class WidgetStyleType : int32_t {
    DEFAULT = 0,
    HOVER = 1,
    ACTIVE,
    FOCUS,
    _COUNT
};

struct UI;

struct UIWidget {
    explicit UIWidget(UI* ui, std::string id) : m_id(std::move(id)), m_ui(ui) {
    }

    std::string m_id;
    UI* m_ui;
};

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

struct StyleVariableStore {
public:
    void set(const std::string& key, GenericValue value) {
        auto existing_it = vars.find(key);

        if (existing_it != vars.end()) {
            existing_it->second = std::move(value);
            return;
        }

        vars.emplace(key, std::move(value));
    }

    template <typename T>
    std::optional<T> get(const std::string& key) const {
        auto value_it = vars.find(key);

        if (value_it == vars.end()) {
            return std::nullopt;
        }

        if (const T* held = std::get_if<T>(&value_it->second)) {
            return *held;
        }

        return std::nullopt;
    }

    std::unordered_map<std::string, GenericValue> vars;
};

struct WidgetStyle {
public:
    StyleVariableStore vars;

    UIWidgetColor color;
    UIWidgetColor border_color;
    UIWidgetColor background_color;

    static void lerp(WidgetStyle& style, const WidgetStyle& target, float dt) {
        style.color.tick(target.color, dt);
        style.border_color.tick(target.border_color, dt);
        style.background_color.tick(target.background_color, dt);

        for (auto& [key, value] : style.vars.vars) {
            auto target_it = target.vars.vars.find(key);

            if (target_it == target.vars.vars.end()) {
                continue;
            }

            std::visit(
                [&](auto& current_value) {
                    using T = std::decay_t<decltype(current_value)>;

                    if (const T* target_value = std::get_if<T>(&target_it->second)) {
                        current_value.tick(*target_value, dt);
                    }
                },
                value
            );
        }
    }

    void adopt_missing_keys_from(const WidgetStyle& target) {
        for (const auto& [key, target_value] : target.vars.vars) {
            if (!vars.vars.contains(key)) {
                vars.vars.emplace(key, target_value);
            }
        }
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

        for (const auto& [key, value] : vars.vars) {
            auto target_it = target.vars.vars.find(key);

            if (target_it == target.vars.vars.end()) {
                continue;
            }

            bool close = std::visit(
                [&](const auto& current_value) {
                    using T = std::decay_t<decltype(current_value)>;
                    const T* target_value = std::get_if<T>(&target_it->second);
                    return target_value == nullptr || current_value.is_close(*target_value, epsilon);
                },
                value
            );

            if (!close) {
                return false;
            }
        }

        return true;
    }
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

struct WidgetState {
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
               (opacity >= VISIBILITY_OPACITY_THRESHOLD ||
                current_opacity.value >= VISIBILITY_OPACITY_THRESHOLD);
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

class UICachedTextBase {
public:
    const char* c_str() const {
        return m_text.c_str();
    }

    const std::string& str() const {
        return m_text;
    }

    void set_font(ImFont* font) {
        if (font == nullptr || font == m_font) {
            return;
        }

        m_font = font;
        m_size_dirty = true;
    }

    ImVec2 text_size(ImFont* font) {
        if (font != nullptr && font != m_font) {
            m_font = font;
            m_size_dirty = true;
        }

        if (m_size_dirty) {
            recompute_size();
        }

        return m_text_size;
    }

    ImVec2 text_size() {
        return text_size(ImGui::GetFont());
    }

protected:
    void set_text(std::string text) {
        m_text = std::move(text);
        m_size_dirty = true;
    }

private:
    void recompute_size() {
        if (m_font != nullptr) {
            ImGui::PushFont(m_font);
        }

        m_text_size = ImGui::CalcTextSize(m_text.c_str());

        if (m_font != nullptr) {
            ImGui::PopFont();
        }

        m_size_dirty = false;
    }

    std::string m_text;
    ImFont* m_font = nullptr;
    ImVec2 m_text_size;
    bool m_size_dirty = true;
};

template <typename... Args>
class UITextFormatted : public UICachedTextBase {
public:
    explicit UITextFormatted(std::string fmt) : m_fmt(std::move(fmt)) {
        recompute_text();
    }

    void set(std::tuple<Args...> new_values) {
        if (new_values == m_values) {
            return;
        }

        m_values = std::move(new_values);
        recompute_text();
    }

private:
    void recompute_text() {
        set_text(
            std::apply(
                [this](auto const&... vals) { return std::vformat(m_fmt, std::make_format_args(vals...)); }, m_values
            )
        );
    }

    std::string m_fmt;
    std::tuple<Args...> m_values = {};
};

template <typename T>
class UIText : public UICachedTextBase {
public:
    explicit UIText(T value) : m_value(std::move(value)) {
        recompute_text();
    }

    void set(T value) {
        if (value == m_value) {
            return;
        }

        m_value = std::move(value);
        recompute_text();
    }

private:
    void recompute_text() {
        if constexpr (std::is_same_v<T, std::string>) {
            set_text(m_value);
        } else {
            set_text(std::format("{}", m_value));
        }
    }

    T m_value;
};
