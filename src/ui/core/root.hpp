#pragma once

#include "input.hpp"

#include <utility>

namespace ui {
    class UiLayer final : public Node {
    public:
        UiLayer(InputLayer layer, InputPolicy policy);

        [[nodiscard]] InputLayer input_layer() const {
            return m_layer;
        }
        [[nodiscard]] InputPolicy input_policy() const {
            return m_policy;
        }
        void set_input_policy(InputPolicy policy) {
            m_policy = policy;
        }

    private:
        InputLayer m_layer;
        InputPolicy m_policy;
    };

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
        [[nodiscard]] InputRouter& input_router() {
            return m_input_router;
        }
        [[nodiscard]] const InputRouter& input_router() const {
            return m_input_router;
        }

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
