#pragma once

#include "style.hpp"

#include <algorithm>

namespace ui {
    static constexpr float OPACITY_TRANSITION_DURATION = 0.15F;
    static constexpr float TRANSITION_SETTLE_EPSILON = 0.003f;
    static constexpr float VISIBILITY_OPACITY_THRESHOLD = 0.002f;

    struct StyleTransitionData {
        StyleType to = StyleType::DEFAULT;
        bool done = true;

        void start(StyleType new_to) {
            to = new_to;
            done = false;
        }

        void end() {
            done = true;
        }
    };

    /// owns style slots and interpolates the selected slot and opacity.
    /// widgets use it as the single source for appearance and visual input acceptance.
    class VisualState {
    public:
        VisualState() {
            current_opacity.value = m_opacity;
            snap_to_style(StyleType::DEFAULT);
        }

        /// selects a slot without running a style transition.
        void snap_to_style(StyleType type) {
            current_style = styles[static_cast<size_t>(type)];
            transition_data.to = type;
            transition_data.done = true;
            current_style_tracks_target = true;
        }

        [[nodiscard]] bool is_visible() const {
            return visible &&
                   (m_opacity >= VISIBILITY_OPACITY_THRESHOLD || current_opacity.value >= VISIBILITY_OPACITY_THRESHOLD);
        }

        void set_visible(bool value) {
            visible = value;
        }

        void set_opacity(float value) {
            m_opacity = std::clamp(value, 0.0f, 1.0f);
        }

        /// starts or reverses the opacity transition towards fully visible.
        void fade_in() {
            visible = true;
            if (first_frame) {
                current_opacity.value = 0.0F;
            }
            set_opacity(1.0f);
        }

        /// starts a fade to zero and disables visual input immediately.
        void fade_out() {
            set_opacity(0.0f);
        }

        [[nodiscard]] bool accepts_input() const {
            return visible && m_opacity >= VISIBILITY_OPACITY_THRESHOLD;
        }

        [[nodiscard]] float opacity() const {
            if (first_frame) {
                return 0.0f;
            }

            return current_opacity.value;
        }

        /// advances opacity and style interpolation by one simulation frame.
        void update(float dt) {
            if (!first_frame && current_opacity.value == m_opacity && transition_data.done) {
                return;
            }

            const FloatValue target_opacity{m_opacity, OPACITY_TRANSITION_DURATION};
            current_opacity.tick(target_opacity, dt);
            if (current_opacity.is_close(target_opacity, TRANSITION_SETTLE_EPSILON)) {
                current_opacity.value = m_opacity;
            }

            if (!transition_data.done) {
                const Style& target_style = styles[static_cast<size_t>(transition_data.to)];
                Style::lerp(current_style, target_style, dt);

                if (current_style.is_close_to(target_style, TRANSITION_SETTLE_EPSILON)) {
                    transition_data.end();
                    current_style_tracks_target = true;
                }
            }

            first_frame = false;
        }

        /// selects a style slot and begins interpolation when necessary.
        void set_style(StyleType type) {
            if (transition_data.to == type) {
                return;
            }

            current_style.adopt_missing_keys_from(styles[static_cast<size_t>(type)]);
            transition_data.start(type);
            current_style_tracks_target = false;
        }

        /// interaction precedence is active, focus, hover, then default.
        void set_item_state(bool hovered, bool active, bool focused = false) {
            if (active) {
                set_style(StyleType::ACTIVE);
                return;
            }

            if (focused) {
                set_style(StyleType::FOCUS);
                return;
            }

            set_style(hovered ? StyleType::HOVER : StyleType::DEFAULT);
        }

        template <typename Func>
        VisualState& configure_all_styles(Func&& func) {
            for (auto& style : styles) {
                func(style);
            }

            if (transition_data.done && transition_data.to == StyleType::DEFAULT) {
                snap_to_style(StyleType::DEFAULT);
            }

            return *this;
        }

        template <typename Func>
        VisualState& configure_style(StyleType type, Func&& func) {
            func(styles[static_cast<size_t>(type)]);
            if (transition_data.done && transition_data.to == type) {
                snap_to_style(type);
            }
            return *this;
        }

        [[nodiscard]] StyleType style_type() const {
            return transition_data.to;
        }

        /// resolved style currently used for drawing.
        Style& style() {
            return transition_data.done && current_style_tracks_target ? styles[static_cast<size_t>(transition_data.to)]
                                                                       : current_style;
        }

        /// mutable named slot, independent from the current transition.
        Style& style(StyleType type) {
            return styles[static_cast<size_t>(type)];
        }

        [[nodiscard]] const Style& style() const {
            return transition_data.done && current_style_tracks_target ? styles[static_cast<size_t>(transition_data.to)]
                                                                       : current_style;
        }

        [[nodiscard]] const Style& style(StyleType type) const {
            return styles[static_cast<size_t>(type)];
        }

    private:
        StyleTransitionData transition_data;
        FloatValue current_opacity;
        Style styles[static_cast<size_t>(StyleType::_COUNT)];
        Style current_style;
        float m_opacity = 1.0f;
        bool visible = true;
        bool first_frame = true;
        bool current_style_tracks_target = false;
    };

} // namespace ui
