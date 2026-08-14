#include "root.hpp"

#include <stdexcept>

namespace ui {
    UiLayer::UiLayer(InputLayer layer)
        : Node([layer] {
              switch (layer) {
                  case InputLayer::Content:
                      return "content-layer";
                  case InputLayer::Overlay:
                      return "overlay-layer";
                  case InputLayer::Modal:
                      return "modal-layer";
                  case InputLayer::Notification:
                      return "notification-layer";
                  case InputLayer::Count:
                      return "invalid-layer";
              }
              return "unknown-layer";
          }()),
          m_layer(layer) {
        assign_input_layer(layer);
    }

    UiRoot::UiRoot() : Node("ui-root") {
        // children are stored in draw / input order: content first, transient
        // layers last so overlays can take precedence over the content.
        auto content = std::make_unique<UiLayer>(InputLayer::Content);
        m_content = content.get();
        Node::add(std::move(content));

        auto overlay = std::make_unique<UiLayer>(InputLayer::Overlay);
        m_overlay = overlay.get();
        Node::add(std::move(overlay));

        auto modal = std::make_unique<UiLayer>(InputLayer::Modal);
        m_modal = modal.get();
        Node::add(std::move(modal));

        auto notification = std::make_unique<UiLayer>(InputLayer::Notification);
        m_notification = notification.get();
        Node::add(std::move(notification));
    }

    void UiRoot::add(std::unique_ptr<Node> child) {
        m_content->add(std::move(child));
    }

    UiLayer& UiRoot::layer(InputLayer layer) {
        switch (layer) {
            case InputLayer::Content:
                return *m_content;
            case InputLayer::Overlay:
                return *m_overlay;
            case InputLayer::Modal:
                return *m_modal;
            case InputLayer::Notification:
                return *m_notification;
            case InputLayer::Count:
                break;
        }
        throw std::invalid_argument("invalid UI input layer");
    }

    const UiLayer& UiRoot::layer(InputLayer layer) const {
        return const_cast<UiRoot*>(this)->layer(layer);
    }

    InputRouter& UiRoot::input_router() {
        return m_input_router;
    }

    const InputRouter& UiRoot::input_router() const {
        return m_input_router;
    }

    void UiRoot::begin_frame() {
        m_input_router.begin_frame();
    }

    void UiRoot::set_layer_policy(InputLayer layer, InputPolicy policy) {
        m_input_router.set_layer_policy(layer, policy);
    }

} // namespace ui
