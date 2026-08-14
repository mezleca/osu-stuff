#include "overlay.hpp"

namespace ui {
    void OverlayHost::add(std::unique_ptr<Node> overlay, InputLayer layer, InputPolicy policy, bool close_on_cancel) {
        if (overlay == nullptr) {
            return;
        }

        m_root.set_layer_policy(layer, policy);
        overlay->set_cancelable(close_on_cancel);
        m_root.layer(layer).add(std::move(overlay));
        refresh_cancel_target(layer);
    }

    bool OverlayHost::remove(std::string_view id, InputLayer layer) {
        UiLayer& target_layer = m_root.layer(layer);
        Node* target = target_layer.find(id);

        if (target == nullptr || target->parent() != &target_layer) {
            return false;
        }

        m_root.input_router().clear_focus(*target);
        m_root.input_router().clear_cancel_target(*target);

        const bool removed = target_layer.remove(*target) != nullptr;

        refresh_cancel_target(layer);
        return removed;
    }

    void OverlayHost::clear(InputLayer layer) {
        UiLayer& target_layer = m_root.layer(layer);

        while (!target_layer.children().empty()) {
            Node& child = *target_layer.children().back();
            m_root.input_router().clear_focus(child);
            m_root.input_router().clear_cancel_target(child);
            target_layer.remove(child);
        }

        refresh_cancel_target(layer);
    }

    Node* OverlayHost::top(InputLayer layer) {
        UiLayer& target_layer = m_root.layer(layer);

        if (target_layer.children().empty()) {
            return nullptr;
        }

        return target_layer.children().back().get();
    }

    const Node* OverlayHost::top(InputLayer layer) const {
        const UiLayer& target_layer = m_root.layer(layer);

        if (target_layer.children().empty()) {
            return nullptr;
        }

        return target_layer.children().back().get();
    }

    std::size_t OverlayHost::size(InputLayer layer) const {
        return m_root.layer(layer).children().size();
    }

    void OverlayHost::set_cancelable(Node& overlay, bool cancelable, InputLayer layer) {
        overlay.set_cancelable(cancelable);
        refresh_cancel_target(layer);
    }

    void OverlayHost::refresh_cancel_target(InputLayer layer) {
        UiLayer& target_layer = m_root.layer(layer);
        Node* target = nullptr;

        for (const auto& child : target_layer.children()) {
            if (child->visible() && child->cancelable()) {
                target = child.get();
            }
        }

        m_root.input_router().set_cancel_target(layer, target);
    }

} // namespace ui
