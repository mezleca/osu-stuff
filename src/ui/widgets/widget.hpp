#pragma once

#include "../../utils/math.hpp"

#include <string>
#include <format>
#include <imgui.h>

struct AnimatedFloat {
    float value = 0.0f;

    void tick(float target, float speed, float dt) {
        value = math_utils::exp_lerp(value, target, speed, dt);
    }

    void set(float new_value) {
        value = new_value;
    }
};

struct AnimatedColor {
    ImVec4 value = {};

    void tick(ImVec4 target, float speed, float dt) {
        value.x = math_utils::exp_lerp(value.x, target.x, speed, dt);
        value.y = math_utils::exp_lerp(value.y, target.y, speed, dt);
        value.z = math_utils::exp_lerp(value.z, target.z, speed, dt);
        value.w = math_utils::exp_lerp(value.w, target.w, speed, dt);
    }

    void set(ImVec4 new_value) {
        value = new_value;
    }
};

struct WidgetStyle {
    bool visible = true;
    AnimatedFloat alpha;

    void tick(float speed, float dt) {
        alpha.tick(visible ? 1.0f : 0.0f, speed, dt);
    }

    [[nodiscard]] bool is_hidden() const {
        return !visible && alpha.value <= 0.001f;
        ;
    };
};

struct UI;

struct UIWidget {
    explicit UIWidget(UI* ui, std::string id) : m_id(id), m_ui(ui) {};

    std::string m_id;
    UI* m_ui;
};

template <typename... Args>
struct FormattedText {
public:
    explicit FormattedText(std::string fmt) : m_fmt(std::move(fmt)) {
    }

    FormattedText& operator=(std::tuple<Args...> new_values) {
        if (!m_has_value || new_values != m_values) {
            m_values = std::move(new_values);
            recompute();
            m_has_value = true;
        }
        return *this;
    }

    const char* c_str() const {
        return m_cached.c_str();
    }
    const std::string& str() const {
        return m_cached;
    }

private:
    void recompute() {
        m_cached = std::apply(
            [this](auto const&... vals) { return std::vformat(m_fmt, std::make_format_args(vals...)); }, m_values);
    }

    std::string m_fmt;
    std::tuple<Args...> m_values{};
    std::string m_cached;

    bool m_has_value = false;
};
