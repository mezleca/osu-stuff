#pragma once

#include "event.hpp"
#include "layer.hpp"
#include "node.hpp"

#include <array>
#include <optional>
#include <vector>

namespace ui {
    // controls whether a layer lets events reach lower layers.
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

    // controls how the router treats the most recently emitted imgui item.
    struct LastItemOptions {
        bool accepts_input = true;
        bool focus_when_active = false;
    };

    // interaction about the imgui item and its router events.
    struct LastItemState {
        bool hovered = false;
        bool active = false;
        bool focused = false;
        bool registered = false;
        bool handled = false;
    };

    // translates pointer and keyboard input into node events. it also keeps
    // the hit regions, focus, cancel targets, and layer policies in
    // one place so widgets do not implement competing input rules.
    class InputRouter {
    public:
        void begin_frame();
        void set_debug_select_mode(bool enabled);
        void finish_debug_select_mode();
        void clear_debug_select_mode();
        // configure which layer can consume pointer or keyboard events first.
        void set_layer_policy(InputLayer layer, InputPolicy policy);
        // set the node that receives cancel using its inherited layer.
        void set_cancel_target(Node& node);
        // clear the cancel target for a layer with no remaining overlay.
        void clear_cancel_target(InputLayer layer);
        void clear_cancel_target(Node& subtree);
        // register a region using the node's inherited layer.
        void register_region(Node& node, InputRect rect);
        // register a detached node when its layer cannot be inferred.
        void register_region_in_layer(Node& node, InputRect rect, InputLayer layer);

        // mirror the last imgui item in the router and optionally follow its native focus.
        [[nodiscard]] LastItemState observe_last_item(Node& node, LastItemOptions options = {});
        // observe the item and dispatch its pointer events in one operation.
        [[nodiscard]] LastItemState handle_last_item(Node& node, LastItemOptions options = {});
        // focus a node using the layer inherited from the node tree.
        [[nodiscard]] bool set_focus(Node& node);
        // use only for nodes that are not attached to a layer tree yet.
        [[nodiscard]] bool set_focus_in_layer(Node& node, InputLayer layer);

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
        [[nodiscard]] static InputLayer layer_of(const Node& node);
        [[nodiscard]] bool register_last_item(Node& node);
        [[nodiscard]] Node* target_at(ImVec2 position, InputLayer minimum_layer) const;
        [[nodiscard]] std::optional<InputLayer> highest_blocking_layer(EventType type) const;

        std::vector<Region> m_regions;
        static constexpr std::size_t LAYER_COUNT = static_cast<std::size_t>(InputLayer::Count);

        std::array<InputPolicy, LAYER_COUNT> m_policies{};
        Node* m_focused_node = nullptr;
        InputLayer m_focused_layer = InputLayer::Content;
        bool m_debug_select_mode = false;
        bool m_debug_select_release_pending = false;
        std::array<Node*, LAYER_COUNT> m_cancel_targets{};
    };

} // namespace ui
