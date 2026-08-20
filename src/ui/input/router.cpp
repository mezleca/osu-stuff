#include "router.hpp"

#include "../tree/node.hpp"

namespace ui {
    static bool is_pointer_event(EventType type) {
        return type == EventType::PointerMove || type == EventType::PointerDown || type == EventType::PointerUp ||
               type == EventType::Click || type == EventType::ContextClick || type == EventType::Scroll;
    }

    static bool is_keyboard_event(EventType type) {
        return type == EventType::KeyDown || type == EventType::KeyUp || type == EventType::TextInput ||
               type == EventType::Cancel;
    }

    static std::size_t layer_index(InputLayer layer) {
        return static_cast<std::size_t>(layer);
    }

    static InputLayer layer_of(const Node& node) {
        const InputLayer layer = node.input_layer();
        return layer == InputLayer::Count ? InputLayer::Content : layer;
    }

    static bool is_same_or_descendant(const Node* ancestor, const Node* node) {
        for (const Node* current = node; current != nullptr; current = current->parent()) {
            if (current == ancestor) {
                return true;
            }
        }

        return false;
    }

    void InputRouter::begin_frame() {
        m_regions.clear();
        clear_inactive_targets();

        if (m_debug_inspect_release_pending && !ImGui::IsMouseDown(ImGuiMouseButton_Left) &&
            !ImGui::IsMouseReleased(ImGuiMouseButton_Left)) {
            m_debug_inspect_release_pending = false;
        }
    }

    void InputRouter::set_debug_inspect_mode(bool enabled) {
        m_debug_inspect_mode = enabled;
        if (enabled) m_debug_inspect_release_pending = false;
    }

    void InputRouter::finish_debug_inspect_mode() {
        m_debug_inspect_mode = false;
        m_debug_inspect_release_pending = true;
    }

    void InputRouter::clear_debug_inspect_mode() {
        m_debug_inspect_mode = false;
        m_debug_inspect_release_pending = false;
    }

    void InputRouter::set_layer_policy(InputLayer layer, InputPolicy policy) {
        m_policies[layer_index(layer)] = policy;
    }

    void InputRouter::set_keyboard_target(Node& node) {
        m_keyboard_targets[layer_index(layer_of(node))] = &node;
    }

    void InputRouter::clear_keyboard_target(InputLayer layer) {
        m_keyboard_targets[layer_index(layer)] = nullptr;
    }

    void InputRouter::clear_keyboard_target(Node& subtree) {
        for (Node*& target : m_keyboard_targets) {
            if (subtree.contains(target)) target = nullptr;
        }
    }

    void InputRouter::register_region(Node& node, Rect rect) {
        register_region_in_layer(node, rect, layer_of(node));
    }

    void InputRouter::register_region_in_layer(Node& node, Rect rect, InputLayer layer) {
        m_regions.push_back(Region{&node, rect, layer});
    }

    bool InputRouter::capture_pointer(Node& node) {
        if (!node.visible() || !node.accepts_input()) {
            return false;
        }

        m_pointer_capture = &node;
        return true;
    }

    void InputRouter::release_pointer() {
        m_pointer_capture = nullptr;
    }

    void InputRouter::release_pointer(Node& subtree) {
        if (subtree.contains(m_pointer_capture)) {
            release_pointer();
        }
    }

    bool InputRouter::set_focus(Node& node) {
        return set_focus_in_layer(node, layer_of(node));
    }

    bool InputRouter::set_focus_in_layer(Node& node, InputLayer layer) {
        clear_inactive_targets();

        if (!node.visible() || !node.accepts_input()) {
            return false;
        }

        if (m_focused_node == &node) {
            m_focused_layer = layer;
            return true;
        }

        if (m_focused_node != nullptr) {
            UiEvent event = UiEvent::make(EventType::FocusLost);
            const bool handled = dispatch(*m_focused_node, event);
            static_cast<void>(handled);
        }

        m_focused_node = &node;
        m_focused_layer = layer;

        UiEvent event = UiEvent::make(EventType::FocusGained);
        const bool handled = dispatch(node, event);
        static_cast<void>(handled);
        return true;
    }

    void InputRouter::clear_focus() {
        if (m_focused_node == nullptr) {
            return;
        }

        UiEvent event = UiEvent::make(EventType::FocusLost);
        const bool handled = dispatch(*m_focused_node, event);
        static_cast<void>(handled);
        m_focused_node = nullptr;
        m_focused_layer = InputLayer::Content;
    }

    void InputRouter::clear_focus(Node& subtree) {
        if (subtree.contains(m_focused_node)) {
            clear_focus();
        }
    }

    bool InputRouter::dispatch(UiEvent& event) {
        clear_inactive_targets();

        if (debug_inspect_mode()) {
            event.mark_handled();
            return true;
        }

        if (is_keyboard_event(event.type)) {
            // keyboard input follows focus. a blocking layer can consume the
            // event before it reaches a focused node below that layer.
            if (event.type == EventType::Cancel) {
                if (m_focused_node != nullptr && m_keyboard_targets[layer_index(m_focused_layer)] != nullptr) {
                    return dispatch(*m_focused_node, event);
                }

                if (Node* target = topmost_keyboard_target_from(0); target != nullptr) {
                    return dispatch(*target, event);
                }
            }

            const std::optional<InputLayer> blocking_layer = highest_blocking_layer(event.type);

            if (m_focused_node == nullptr) {
                if (blocking_layer.has_value()) {
                    if (Node* target = topmost_keyboard_target_from(layer_index(*blocking_layer)); target != nullptr) {
                        static_cast<void>(dispatch(*target, event));
                    }
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

        if (event.type == EventType::PointerMove || event.type == EventType::PointerUp) {
            // move/up events only make sense while dragging; without an active capture there is
            // no target to flow them through.
            if (m_pointer_capture == nullptr) {
                return false;
            }

            Node* captured = m_pointer_capture;
            const bool handled = dispatch(*captured, event);

            if (event.type == EventType::PointerUp && m_pointer_capture == captured) {
                release_pointer();
            }

            return handled;
        }

        // pointer input resolves the highest eligible layer first, then picks
        // the most recently registered region at that position.
        const std::optional<InputLayer> blocking_layer = highest_blocking_layer(event.type);
        Node* target = target_at(event.position, blocking_layer.value_or(InputLayer::Content), false);

        if (target == nullptr) {
            if (blocking_layer.has_value()) event.mark_handled();
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
        return target_at(position, InputLayer::Content, false);
    }

    Node* InputRouter::debug_node_at(ImVec2 position) const {
        return target_at(position, InputLayer::Content, true);
    }

    void InputRouter::clear_inactive_targets() {
        const auto is_active = [](const Node* node) {
            return node != nullptr && node->visible() && node->accepts_input();
        };

        if (!is_active(m_focused_node)) {
            m_focused_node = nullptr;
            m_focused_layer = InputLayer::Content;
        }

        if (!is_active(m_pointer_capture)) {
            m_pointer_capture = nullptr;
        }

        for (Node*& target : m_keyboard_targets) {
            if (!is_active(target)) {
                target = nullptr;
            }
        }
    }

    Node* InputRouter::target_at(ImVec2 position, InputLayer minimum_layer, bool include_non_input) const {
        const auto minimum = layer_index(minimum_layer);

        Node* target = nullptr;
        Rect target_rect{};

        for (auto it = m_regions.rbegin(); it != m_regions.rend(); ++it) {
            if (layer_index(it->layer) < minimum || !it->rect.contains(position) || it->node == nullptr ||
                !it->node->visible() || (!include_non_input && !it->node->accepts_input())) {
                continue;
            }

            if (target == nullptr) {
                target = it->node;
                target_rect = it->rect;
                continue;
            }

            if (is_same_or_descendant(target, it->node)) {
                target = it->node;
                target_rect = it->rect;
                continue;
            }

            if (is_same_or_descendant(it->node, target)) {
                continue;
            }

            const ImVec2 target_size = target_rect.size();
            const ImVec2 candidate_size = it->rect.size();
            const float target_area = target_size.x * target_size.y;
            const float candidate_area = candidate_size.x * candidate_size.y;

            if (candidate_area < target_area) {
                target = it->node;
                target_rect = it->rect;
            }
        }

        return target;
    }

    Node* InputRouter::topmost_keyboard_target_from(std::size_t minimum_index) const {
        for (std::size_t index = m_keyboard_targets.size(); index-- > minimum_index;) {
            if (m_keyboard_targets[index] != nullptr) {
                return m_keyboard_targets[index];
            }
        }

        return nullptr;
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
