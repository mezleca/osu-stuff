#pragma once

#include "event.hpp"
#include "layer.hpp"
#include "../layout/geometry.hpp"

#include <array>
#include <optional>
#include <vector>

namespace ui {
    class Node;

    enum class InputPolicy : unsigned char {
        PassThrough,
        BlockPointer,
        BlockAll,
    };

    struct Region {
        Node* node;
        Rect rect;
        InputLayer layer;
    };

    inline constexpr std::size_t LAYER_COUNT = static_cast<std::size_t>(InputLayer::Count);

    /// regions are rebuilt every frame in draw order. dispatch selects the
    /// topmost eligible region, then bubbles the event through node parents.
    /// matching pointer presses synthesize Click/ContextClick on release;
    /// focus, pointer capture and keyboard targets are explicit persistent state.
    class InputRouter {
    public:
        /// clears hit-test regions and invalid input targets from the previous frame.
        void begin_frame();
        void set_debug_inspect_mode(bool enabled);
        void finish_debug_inspect_mode();
        void clear_debug_inspect_mode();
        void set_layer_policy(InputLayer layer, InputPolicy policy);
        void set_keyboard_target(Node& node);
        void clear_keyboard_target(InputLayer layer);
        void clear_keyboard_target(Node& subtree);
        void register_region(Node& node, Rect rect);
        /// explicit registration does not change the node's assigned tree layer.
        void register_region_in_layer(Node& node, Rect rect, InputLayer layer);
        bool capture_pointer(Node& node);
        void release_pointer();
        void release_pointer(Node& subtree);

        [[nodiscard]] bool set_focus(Node& node);
        [[nodiscard]] bool set_focus_in_layer(Node& node, InputLayer layer);

        void clear_focus();
        void clear_focus(Node& subtree);

        [[nodiscard]] Node* focused_node() {
            return m_focused_node;
        }

        [[nodiscard]] const Node* focused_node() const {
            return m_focused_node;
        }

        [[nodiscard]] bool debug_inspect_mode() const {
            return m_debug_inspect_mode || m_debug_inspect_release_pending;
        }

        [[nodiscard]] bool dispatch(UiEvent& event);
        /// direct dispatch still bubbles through target ancestors.
        [[nodiscard]] bool dispatch(Node& target, UiEvent& event);
        [[nodiscard]] Node* node_at(ImVec2 position) const;
        /// inspect hit testing includes visible nodes that reject normal input.
        [[nodiscard]] Node* debug_node_at(ImVec2 position) const;

    private:
        void clear_inactive_targets();
        [[nodiscard]] Node* target_at(ImVec2 position, InputLayer minimum_layer, bool include_non_input) const;
        [[nodiscard]] Node* topmost_keyboard_target_from(std::size_t minimum_index) const;
        [[nodiscard]] std::optional<InputLayer> highest_blocking_layer(EventType type) const;

        std::vector<Region> m_regions;
        std::array<InputPolicy, LAYER_COUNT> m_policies{};
        Node* m_focused_node = nullptr;
        InputLayer m_focused_layer = InputLayer::Content;
        bool m_debug_inspect_mode = false;
        bool m_debug_inspect_release_pending = false;
        std::array<Node*, LAYER_COUNT> m_keyboard_targets{};
        Node* m_pointer_capture = nullptr;
        std::array<Node*, 4> m_pressed_targets{};
        std::array<bool, 4> m_pressed_default_prevented{};
    };

} // namespace ui
