#include "input-bridge.hpp"

#include "../tree/node.hpp"

namespace ui {
    ItemInputState ImGuiInputBridge::observe(Node& node) {
        ItemInputState state;
        const ImVec2 item_min = ImGui::GetItemRectMin();
        const ImVec2 item_max = ImGui::GetItemRectMax();
        const bool has_item_rect = item_max.x > item_min.x && item_max.y > item_min.y;

        if (node.accepts_input() && node.visible() && ImGui::IsItemVisible()) {
            m_router.register_region(node, {item_min, item_max});
            state.registered = true;
        }

        if (m_router.debug_inspect_mode()) {
            return state;
        }

        const bool popup_open = ImGui::IsPopupOpen(nullptr, ImGuiPopupFlags_AnyPopup);
        state.hovered =
            ImGui::IsItemHovered() || (!popup_open && has_item_rect && ImGui::IsMouseHoveringRect(item_min, item_max));
        state.active = ImGui::IsItemActive();

        if (state.active && node.accepts_input() && node.accepts_focus()) {
            state.focused = m_router.set_focus(node);
        } else if (m_router.focused_node() == &node) {
            m_router.clear_focus();
        }

        return state;
    }

    ItemInputState ImGuiInputBridge::handle(Node& node) {
        ItemInputState state = observe(node);

        if (!state.registered || m_router.debug_inspect_mode() || !state.hovered) {
            return state;
        }

        const ImVec2 position = ImGui::GetMousePos();
        const auto dispatch_pointer = [&](EventType type, PointerButton button) {
            UiEvent event = UiEvent::make(type);
            event.position = position;
            event.button = button;
            state.handled = m_router.dispatch(event) || state.handled;
        };

        const auto dispatch_click = [&](ImGuiMouseButton mouse_button, PointerButton button, EventType click_type) {
            if (ImGui::IsItemClicked(mouse_button)) {
                dispatch_pointer(click_type, button);
            }
        };

        dispatch_click(ImGuiMouseButton_Left, PointerButton::Left, EventType::Click);
        dispatch_click(ImGuiMouseButton_Right, PointerButton::Right, EventType::ContextClick);
        return state;
    }
} // namespace ui
