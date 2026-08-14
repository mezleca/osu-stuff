#pragma once

#include "modal.hpp"
#include "root.hpp"

#include <memory>
#include <string_view>

namespace ui {
    // owns overlay nodes in the root's layers and keeps their input policy,
    // cancel target, focus, and removal state synchronized.
    class OverlayHost {
    public:
        explicit OverlayHost(UiRoot& root) : m_root(root) {}

        // transfer ownership to the selected layer.
        void
        add(std::unique_ptr<Node> overlay, InputLayer layer = InputLayer::Overlay,
            InputPolicy policy = InputPolicy::PassThrough, bool close_on_cancel = false);

        void add_overlay(
            std::unique_ptr<Node> overlay, InputPolicy policy = InputPolicy::PassThrough, bool close_on_cancel = false
        );
        void add_modal(std::unique_ptr<Modal> modal, bool close_on_cancel = true);
        [[nodiscard]] bool remove(std::string_view id, InputLayer layer = InputLayer::Overlay);
        void clear(InputLayer layer = InputLayer::Overlay);

        [[nodiscard]] Node* top(InputLayer layer = InputLayer::Overlay);
        [[nodiscard]] const Node* top(InputLayer layer = InputLayer::Overlay) const;
        [[nodiscard]] std::size_t size(InputLayer layer = InputLayer::Overlay) const;

        // set the policy for every node in the layer.
        void set_policy(InputLayer layer, InputPolicy policy) {
            m_root.set_layer_policy(layer, policy);
        }

        void set_cancelable(Node& overlay, bool cancelable, InputLayer layer = InputLayer::Overlay);

    private:
        void refresh_cancel_target(InputLayer layer);
        UiRoot& m_root;
    };

} // namespace ui
