#pragma once

#include "style.hpp"

static constexpr float OPACITY_TRANSITION_SPEED = 12.0f;
static constexpr float TRANSITION_SETTLE_EPSILON = 0.002f;
static constexpr float VISIBILITY_OPACITY_THRESHOLD = 0.001f;

struct StyleTransitionData {
    float elapsed = 0.0f;
    UIStyleType from = UIStyleType::DEFAULT;
    UIStyleType to = UIStyleType::DEFAULT;
    bool done = true;

    void start(UIStyleType new_from, UIStyleType new_to) {
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
    WidgetState() {
        current_opacity.value = opacity;
    }

    void snap_to_style(UIStyleType type) {
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

    [[nodiscard]] float get_opacity() const {
        if (first_frame) {
            return 0.0f;
        }

        return current_opacity.value;
    }

    const ImVec2& get_size() {
        return size;
    }

    void update(float dt) {
        current_opacity.tick(UIWidgetFloat{opacity, OPACITY_TRANSITION_SPEED}, dt);

        if (!transition_data.done) {
            const UIStyle& target_style = styles[static_cast<size_t>(transition_data.to)];
            transition_data.elapsed += dt;
            UIStyle::lerp(current_style, target_style, dt);

            if (current_style.is_close_to(target_style, TRANSITION_SETTLE_EPSILON)) {
                transition_data.end();
            }
        }

        if (ImGui::GetCurrentContext() != nullptr) {
            size = ImGui::GetItemRectSize();
        }

        first_frame = false;
    }

    void set_style(UIStyleType type) {
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

    [[nodiscard]] UIStyleType get_style_type() const {
        return transition_data.to;
    }

    UIStyle& get_style() {
        return current_style;
    }

    UIStyle& get_style(UIStyleType type) {
        return styles[static_cast<size_t>(type)];
    }

private:
    StyleTransitionData transition_data;
    UIWidgetFloat current_opacity;
    UIStyle styles[static_cast<size_t>(UIStyleType::_COUNT)];
    UIStyle current_style;
    ImVec2 size = {0.0f, 0.0f};
    float opacity = 1.0f;
    bool visible = true;
    bool first_frame = false;
};
