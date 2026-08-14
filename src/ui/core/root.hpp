#pragma once

#include "input.hpp"

#include <utility>

namespace ui {
    // groups nodes that share a z-order and input layer.
    class UiLayer final : public Node {
    public:
        explicit UiLayer(InputLayer layer);

        [[nodiscard]] InputLayer input_layer() const {
            return m_layer;
        }

    private:
        InputLayer m_layer;
    };

    // owns the fixed layer tree and the router used by the whole ui frame.
    // application content goes into content; transient nodes use the other
    // layers so drawing and input follow the same ordering.
    class UiRoot final : public Node {
    public:
        UiRoot();

        // add application content to the default content layer.
        void add(std::unique_ptr<Node> child);

        template <typename T, typename... Args>
        T& emplace_child(Args&&... args) {
            return m_content->emplace_child<T>(std::forward<Args>(args)...);
        }
        [[nodiscard]] UiLayer& layer(InputLayer layer);
        [[nodiscard]] const UiLayer& layer(InputLayer layer) const;
        [[nodiscard]] InputRouter& input_router();
        [[nodiscard]] const InputRouter& input_router() const;

        // clear frame input while keeping the node tree alive.
        void begin_frame();
        void set_layer_policy(InputLayer layer, InputPolicy policy);

    private:
        UiLayer* m_content = nullptr;
        UiLayer* m_overlay = nullptr;
        UiLayer* m_modal = nullptr;
        UiLayer* m_notification = nullptr;
        InputRouter m_input_router;
    };

} // namespace ui
