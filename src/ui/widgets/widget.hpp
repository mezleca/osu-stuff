#pragma once

#include "../style/styled-node.hpp"
#include "../imgui/input-bridge.hpp"
#include "../style/state.hpp"
#include "widget-type.hpp"

#include <string>

namespace ui {
    class Widget : public StyledNode {
    public:
        explicit Widget(std::string id, WidgetType type = WidgetType::Unknown) : StyledNode(std::move(id), type) {
            set_font(font());
        }

        Widget& set_font(ImFont* font) override {
            StyledNode::set_font(font);
            state().configure_all_styles([font](Style& style) { style.font(font); });
            return *this;
        }

        [[nodiscard]] bool accepts_input() const override {
            return m_state.accepts_input();
        }

        void apply_input_state(const ItemInputState& input, bool active = false) {
            state().set_item_state(input.hovered, input.active || active);
        }

        [[nodiscard]] VisualState& state() {
            return m_state;
        }

        [[nodiscard]] Style& style() {
            return state().style();
        }

        [[nodiscard]] const Style& style() const {
            return m_state.style();
        }

    private:
        [[nodiscard]] const Style& draw_style() const override {
            return m_state.style();
        }

        [[nodiscard]] float draw_opacity() const override {
            return m_state.opacity();
        }

        VisualState m_state;
    };

} // namespace ui
