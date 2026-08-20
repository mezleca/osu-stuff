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
            return *this;
        }

        [[nodiscard]] bool accepts_input() const override {
            return Node::accepts_input() && state().accepts_input();
        }

        /// converts an input snapshot into active/focus/hover style selection.
        void apply_input_state(const ItemInputState& input, bool active = false) {
            state().set_item_state(input.hovered, input.active || active, input.focused);
        }

    private:
        [[nodiscard]] float draw_opacity() const override {
            return state().opacity();
        }
    };

} // namespace ui
