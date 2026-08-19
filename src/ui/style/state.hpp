#pragma once

#include "style.hpp"

#include <algorithm>

namespace ui {
    static constexpr float OPACITY_TRANSITION_SPEED = 15.0f;
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

    // owns a node's style slots and interpolates the selected slot, opacity,
    // and visibility over time. widgets use it as the single source for
    // appearance and input acceptance.
    class VisualState {
    public:
        VisualState() {
            current_opacity.value = m_opacity;
        }

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

        void fade_in() {
            visible = true;
            if (first_frame) {
                current_opacity.value = 0.0F;
            }
            set_opacity(1.0f);
        }

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

        [[nodiscard]] const ImVec2& size() const {
            return m_size;
        }

        void set_size(ImVec2 value) {
            m_size = value;
        }

        void update(float dt) {
            current_opacity.tick(FloatValue{m_opacity, OPACITY_TRANSITION_SPEED}, dt);

            if (!transition_data.done) {
                const Style& target_style = styles[static_cast<size_t>(transition_data.to)];
                Style::lerp(current_style, target_style, dt);

                if (current_style.is_close_to(target_style, TRANSITION_SETTLE_EPSILON)) {
                    transition_data.end();
                    current_style_tracks_target = true;
                }
            }

            if (ImGui::GetCurrentContext() != nullptr) {
                m_size = ImGui::GetItemRectSize();
            }

            first_frame = false;
        }

        void set_style(StyleType type) {
            if (transition_data.to == type) {
                return;
            }

            current_style.adopt_missing_keys_from(styles[static_cast<size_t>(type)]);
            transition_data.start(type);
            current_style_tracks_target = false;
        }

        void set_item_state(bool hovered, bool active) {
            if (active) {
                set_style(StyleType::ACTIVE);
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

        Style& style() {
            return transition_data.done && current_style_tracks_target ? styles[static_cast<size_t>(transition_data.to)]
                                                                       : current_style;
        }

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
        ImVec2 m_size = {0.0f, 0.0f};
        float m_opacity = 1.0f;
        bool visible = true;
        bool first_frame = true;
        bool current_style_tracks_target = false;
    };

} // namespace ui
