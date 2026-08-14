#pragma once

#include "style.hpp"

#include <algorithm>

namespace ui {
    static constexpr float OPACITY_TRANSITION_SPEED = 15.0f;
    static constexpr float TRANSITION_SETTLE_EPSILON = 0.003f;
    static constexpr float VISIBILITY_OPACITY_THRESHOLD = 0.002f;

    struct StyleTransitionData {
        float elapsed = 0.0f;
        StyleType from = StyleType::DEFAULT;
        StyleType to = StyleType::DEFAULT;
        bool done = true;

        void start(StyleType new_from, StyleType new_to) {
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

    class VisualState {
    public:
        VisualState() {
            current_opacity.value = opacity;
        }

        void snap_to_style(StyleType type) {
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
            opacity = std::clamp(value, 0.0f, 1.0f);
        }

        void fade_in() {
            visible = true;
            set_opacity(1.0f);
        }

        void fade_out() {
            set_opacity(0.0f);
        }

        [[nodiscard]] bool accepts_input() const {
            return visible && opacity >= VISIBILITY_OPACITY_THRESHOLD;
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
            current_opacity.tick(FloatValue{opacity, OPACITY_TRANSITION_SPEED}, dt);

            if (!transition_data.done) {
                const Style& target_style = styles[static_cast<size_t>(transition_data.to)];
                transition_data.elapsed += dt;
                Style::lerp(current_style, target_style, dt);

                if (current_style.is_close_to(target_style, TRANSITION_SETTLE_EPSILON)) {
                    transition_data.end();
                }
            }

            if (ImGui::GetCurrentContext() != nullptr) {
                size = ImGui::GetItemRectSize();
            }

            first_frame = false;
        }

        void set_style(StyleType type) {
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

        [[nodiscard]] StyleType get_style_type() const {
            return transition_data.to;
        }

        Style& get_style() {
            return current_style;
        }

        Style& get_style(StyleType type) {
            return styles[static_cast<size_t>(type)];
        }

    private:
        StyleTransitionData transition_data;
        FloatValue current_opacity;
        Style styles[static_cast<size_t>(StyleType::_COUNT)];
        Style current_style;
        ImVec2 size = {0.0f, 0.0f};
        float opacity = 1.0f;
        bool visible = true;
        bool first_frame = true;
    };

} // namespace ui
