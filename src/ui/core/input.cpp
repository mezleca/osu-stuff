#include "input.hpp"

namespace ui {
    static UiEvent make_event(EventType type) {
        return {
            .type = type,
            .position = {},
            .scroll = {},
            .button = PointerButton::None,
            .key = 0,
            .text = {},
            .handled = false,
            .propagation_stopped = false,
            .default_prevented = false,
        };
    }

    void InputRouter::begin_frame() {
        // regions describe imgui items for one frame and must not leak into the next frame
        // where item rectangles may no longer exist.
        m_regions.clear();

        if (m_debug_select_release_pending && !ImGui::IsMouseDown(ImGuiMouseButton_Left) &&
            !ImGui::IsMouseReleased(ImGuiMouseButton_Left)) {
            m_debug_select_release_pending = false;
        }
    }

    void InputRouter::set_debug_select_mode(bool enabled) {
        m_debug_select_mode = enabled;
        if (enabled) {
            m_debug_select_release_pending = false;
        }
    }

    void InputRouter::finish_debug_select_mode() {
        m_debug_select_mode = false;
        m_debug_select_release_pending = true;
    }

    void InputRouter::clear_debug_select_mode() {
        m_debug_select_mode = false;
        m_debug_select_release_pending = false;
    }

    void InputRouter::set_layer_policy(InputLayer layer, InputPolicy policy) {
        m_policies[layer_index(layer)] = policy;
    }

    void InputRouter::set_cancel_target(Node& node) {
        m_cancel_targets[layer_index(layer_of(node))] = &node;
    }

    void InputRouter::clear_cancel_target(InputLayer layer) {
        m_cancel_targets[layer_index(layer)] = nullptr;
    }

    void InputRouter::clear_cancel_target(Node& subtree) {
        for (Node*& target : m_cancel_targets) {
            for (Node* current = target; current != nullptr; current = current->parent()) {
                if (current == &subtree) {
                    target = nullptr;
                    break;
                }
            }
        }
    }

    void InputRouter::register_region(Node& node, InputRect rect) {
        register_region_in_layer(node, rect, layer_of(node));
    }

    void InputRouter::register_region_in_layer(Node& node, InputRect rect, InputLayer layer) {
        m_regions.push_back(Region{&node, rect, layer});
    }

    bool InputRouter::register_last_item(Node& node) {
        if (!node.visible() || !ImGui::IsItemVisible()) {
            return false;
        }

        register_region(node, InputRect{ImGui::GetItemRectMin(), ImGui::GetItemRectMax()});
        return true;
    }

    LastItemState InputRouter::observe_last_item(Node& node, LastItemOptions options) {
        // imgui owns the item interaction; this only records its region and
        // mirrors hover/active/focus state into the node router.
        LastItemState state;
        state.registered = options.accepts_input && register_last_item(node);

        if (debug_select_mode()) {
            return state;
        }

        state.hovered = ImGui::IsItemHovered();
        state.active = ImGui::IsItemActive();

        if (!options.focus_when_active) {
            return state;
        }

        if (state.active && options.accepts_input) {
            state.focused = set_focus(node);
            return state;
        }

        if (m_focused_node == &node) {
            clear_focus();
        }

        return state;
    }

    LastItemState InputRouter::handle_last_item(Node& node, LastItemOptions options) {
        LastItemState state = observe_last_item(node, options);

        if (!state.registered || debug_select_mode() || !state.hovered) {
            return state;
        }

        // convert the current imgui item interaction into the same events used
        // by sdl input, so widgets do not need a second click implementation.
        const ImVec2 position = ImGui::GetMousePos();
        auto dispatch_pointer = [&](EventType type, PointerButton button) {
            UiEvent event = make_event(type);
            event.position = position;
            event.button = button;
            state.handled = dispatch(event) || state.handled;
        };

        const auto dispatch_button_events = [&](ImGuiMouseButton mouse_button, PointerButton button,
                                                EventType click_type) {
            if (ImGui::IsMouseClicked(mouse_button)) {
                dispatch_pointer(EventType::PointerDown, button);
            }
            if (ImGui::IsMouseReleased(mouse_button)) {
                dispatch_pointer(EventType::PointerUp, button);
            }
            if (ImGui::IsItemClicked(mouse_button)) {
                dispatch_pointer(click_type, button);
            }
        };

        dispatch_button_events(ImGuiMouseButton_Left, PointerButton::Left, EventType::Click);
        dispatch_button_events(ImGuiMouseButton_Right, PointerButton::Right, EventType::ContextClick);
        return state;
    }

    bool InputRouter::set_focus(Node& node) {
        return set_focus_in_layer(node, layer_of(node));
    }

    bool InputRouter::set_focus_in_layer(Node& node, InputLayer layer) {
        if (!node.visible()) {
            return false;
        }

        if (m_focused_node == &node) {
            m_focused_layer = layer;
            return true;
        }

        if (m_focused_node != nullptr) {
            UiEvent event = make_event(EventType::FocusLost);
            const bool handled = dispatch(*m_focused_node, event);
            static_cast<void>(handled);
        }

        m_focused_node = &node;
        m_focused_layer = layer;

        UiEvent event = make_event(EventType::FocusGained);
        const bool handled = dispatch(node, event);
        static_cast<void>(handled);
        return true;
    }

    void InputRouter::clear_focus() {
        if (m_focused_node == nullptr) {
            return;
        }

        UiEvent event = make_event(EventType::FocusLost);
        const bool handled = dispatch(*m_focused_node, event);
        static_cast<void>(handled);
        m_focused_node = nullptr;
        m_focused_layer = InputLayer::Content;
    }

    void InputRouter::clear_focus(Node& subtree) {
        for (Node* current = m_focused_node; current != nullptr; current = current->parent()) {
            if (current == &subtree) {
                clear_focus();
                return;
            }
        }
    }

    bool InputRouter::dispatch(UiEvent& event) {
        if (debug_select_mode()) {
            event.mark_handled();
            return true;
        }

        if (is_keyboard_event(event.type)) {
            // keyboard input follows focus. a blocking layer can consume the
            // event before it reaches a focused node below that layer.
            if (event.type == EventType::Cancel) {
                for (std::size_t index = m_cancel_targets.size(); index-- > 0;) {
                    if (m_cancel_targets[index] != nullptr) {
                        return dispatch(*m_cancel_targets[index], event);
                    }
                }
            }

            const std::optional<InputLayer> blocking_layer = highest_blocking_layer(event.type);
            if (m_focused_node == nullptr) {
                if (blocking_layer.has_value()) {
                    event.mark_handled();
                }
                return event.handled;
            }

            if (blocking_layer.has_value() && layer_index(m_focused_layer) < layer_index(*blocking_layer)) {
                event.mark_handled();
                return true;
            }

            return dispatch(*m_focused_node, event);
        }

        if (!is_pointer_event(event.type)) {
            return false;
        }

        // pointer input resolves the highest eligible layer first, then picks
        // the most recently registered region at that position.
        const std::optional<InputLayer> blocking_layer = highest_blocking_layer(event.type);
        Node* target = target_at(event.position, blocking_layer.value_or(InputLayer::Content));
        if (target == nullptr) {
            if (blocking_layer.has_value()) {
                event.mark_handled();
            }
            return event.handled;
        }

        return dispatch(*target, event);
    }

    bool InputRouter::dispatch(Node& target, UiEvent& event) {
        Node* current = &target;
        while (current != nullptr && !event.propagation_stopped) {
            Node* next = current->parent();
            if (current->on_event) {
                current->on_event(event);
            }

            current = next;
        }

        return event.handled;
    }

    Node* InputRouter::node_at(ImVec2 position) const {
        return target_at(position, InputLayer::Content);
    }

    bool InputRouter::is_pointer_event(EventType type) {
        return type == EventType::PointerMove || type == EventType::PointerDown || type == EventType::PointerUp ||
               type == EventType::Click || type == EventType::ContextClick || type == EventType::Scroll;
    }

    bool InputRouter::is_keyboard_event(EventType type) {
        return type == EventType::KeyDown || type == EventType::KeyUp || type == EventType::TextInput ||
               type == EventType::Cancel;
    }

    std::size_t InputRouter::layer_index(InputLayer layer) {
        return static_cast<std::size_t>(layer);
    }

    InputLayer InputRouter::layer_of(const Node& node) {
        const InputLayer layer = node.input_layer();
        return layer == InputLayer::Count ? InputLayer::Content : layer;
    }

    Node* InputRouter::target_at(ImVec2 position, InputLayer minimum_layer) const {
        const auto minimum = layer_index(minimum_layer);
        Node* target = nullptr;

        for (auto it = m_regions.rbegin(); it != m_regions.rend(); ++it) {
            if (layer_index(it->layer) < minimum || !it->rect.contains(position)) {
                continue;
            }

            if (target == nullptr) {
                target = it->node;
                continue;
            }

            if (target->contains(it->node)) {
                target = it->node;
                continue;
            }

            if (!it->node->contains(target)) {
                return target;
            }
        }

        return target;
    }

    std::optional<InputLayer> InputRouter::highest_blocking_layer(EventType type) const {
        const bool pointer_event = is_pointer_event(type);
        for (std::size_t index = m_policies.size(); index-- > 0;) {
            const InputPolicy policy = m_policies[index];
            if ((pointer_event && policy != InputPolicy::PassThrough) ||
                (!pointer_event && policy == InputPolicy::BlockAll)) {
                return static_cast<InputLayer>(index);
            }
        }

        return std::nullopt;
    }

} // namespace ui
