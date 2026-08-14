#pragma once

#include "event.hpp"
#include "node.hpp"

#include <array>
#include <optional>
#include <vector>

namespace ui {
    enum class InputLayer : unsigned char {
        Content,
        Overlay,
        Modal,
        Notification,
    };

    enum class InputPolicy : unsigned char {
        PassThrough,
        BlockPointer,
        BlockAll,
    };

    struct InputRect {
        ImVec2 min{};
        ImVec2 max{};

        [[nodiscard]] bool contains(ImVec2 point) const {
            return point.x >= min.x && point.x <= max.x && point.y >= min.y && point.y <= max.y;
        }
    };

    class InputRouter {
    public:
        void begin_frame();
        void set_debug_select_mode(bool enabled);
        void finish_debug_select_mode();
        void clear_debug_select_mode();
        void set_layer_policy(InputLayer layer, InputPolicy policy);
        void set_cancel_target(InputLayer layer, Node* node);
        void clear_cancel_target(Node& subtree);
        void register_region(Node& node, InputRect rect, InputLayer layer = InputLayer::Content);
        // register the last imgui item without generating wrapper events.
        [[nodiscard]] bool register_last_item(Node& node, InputLayer layer = InputLayer::Content);
        // register the last imgui item and dispatch pointer events for it.
        [[nodiscard]] bool dispatch_last_item(Node& node, InputLayer layer = InputLayer::Content);
        [[nodiscard]] bool set_focus(Node& node, InputLayer layer = InputLayer::Content);
        void clear_focus();
        void clear_focus(Node& subtree);

        [[nodiscard]] Node* focused_node() {
            return m_focused_node;
        }
        [[nodiscard]] const Node* focused_node() const {
            return m_focused_node;
        }

        [[nodiscard]] bool debug_select_mode() const {
            return m_debug_select_mode || m_debug_select_release_pending;
        }

        [[nodiscard]] bool dispatch(UiEvent& event);
        [[nodiscard]] bool dispatch(Node& target, UiEvent& event);
        [[nodiscard]] Node* node_at(ImVec2 position) const;

    private:
        struct Region {
            Node* node;
            InputRect rect;
            InputLayer layer;
        };

        [[nodiscard]] static bool is_pointer_event(EventType type);
        [[nodiscard]] static bool is_keyboard_event(EventType type);
        [[nodiscard]] static std::size_t layer_index(InputLayer layer);
        [[nodiscard]] Node* target_at(ImVec2 position, InputLayer minimum_layer) const;
        [[nodiscard]] std::optional<InputLayer> highest_blocking_layer(EventType type) const;

        std::vector<Region> m_regions;
        std::array<InputPolicy, 4> m_policies{
            InputPolicy::PassThrough,
            InputPolicy::PassThrough,
            InputPolicy::PassThrough,
            InputPolicy::PassThrough,
        };
        Node* m_focused_node = nullptr;
        InputLayer m_focused_layer = InputLayer::Content;
        bool m_debug_select_mode = false;
        bool m_debug_select_release_pending = false;
        std::array<Node*, 4> m_cancel_targets{};
    };

} // namespace ui
