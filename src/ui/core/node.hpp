#pragma once

#include "event.hpp"
#include "geometry.hpp"
#include "layer.hpp"

#include <memory>
#include <functional>
#include <chrono>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <stdexcept>
#include <utility>
#include <vector>

namespace ui {
    // base node for the ui tree. it owns children, provides lifecycle hooks,
    // and exposes the common state used by layout, drawing, and input.
    class Node {
    public:
        explicit Node(std::string id = {});
        virtual ~Node() = default;

        Node(const Node&) = delete;
        Node& operator=(const Node&) = delete;
        bool add(std::unique_ptr<Node> child);

        template <typename T>
        T& add_child(std::unique_ptr<T> child) {
            if (child == nullptr || child.get() == this) {
                throw std::invalid_argument("a node cannot be added as its own child");
            }

            T* result = child.get();
            if (!add(std::move(child))) {
                throw std::logic_error("failed to add node child");
            }

            return *result;
        }

        template <typename T, typename... Args>
        T& emplace_child(Args&&... args) {
            return add_child(std::make_unique<T>(std::forward<Args>(args)...));
        }

        void update(float dt);
        virtual void draw();
        std::unique_ptr<Node> remove(Node& child);
        [[nodiscard]] Node* find(std::string_view id);
        [[nodiscard]] const Node* find(std::string_view id) const;
        [[nodiscard]] bool contains(const Node* node) const;

        [[nodiscard]] const std::string& id() const {
            return m_id;
        }

        [[nodiscard]] uint64_t identity() const {
            return m_identity;
        }

        void set_id(std::string id) {
            m_id = std::move(id);
        }

        [[nodiscard]] Node* parent() {
            return m_parent;
        }

        [[nodiscard]] const Node* parent() const {
            return m_parent;
        }

        [[nodiscard]] const std::vector<std::unique_ptr<Node>>& children() const {
            return m_children;
        }

        [[nodiscard]] InputLayer input_layer() const {
            return m_input_layer;
        }

        [[nodiscard]] bool visible() const {
            return m_visible;
        }

        void set_visible(bool visible) {
            m_visible = visible;
        }

        [[nodiscard]] bool cancelable() const {
            return m_cancelable;
        }

        void set_cancelable(bool cancelable) {
            m_cancelable = cancelable;
        }

        [[nodiscard]] LayoutState& layout() {
            return m_layout;
        }

        [[nodiscard]] const LayoutState& layout() const {
            return m_layout;
        }

        [[nodiscard]] double draw_time_ms() const {
            return m_draw_time_ms;
        }

        virtual std::optional<std::string> get_content() const;
        virtual bool set_content(std::string content);

        // assign one handler and filter event.type inside it when needed
        std::function<void(UiEvent&)> on_event;

    protected:
        class DrawScope {
        public:
            explicit DrawScope(Node& node);
            ~DrawScope();

            DrawScope(const DrawScope&) = delete;
            DrawScope& operator=(const DrawScope&) = delete;

        private:
            Node& m_node;
            std::chrono::steady_clock::time_point m_start;
        };

        DrawScope measure_draw();
        void position_in_parent();
        void skip_draw();
        void assign_input_layer(InputLayer layer);

        virtual void on_update(float dt);
        virtual void on_layout();
        virtual void on_draw();
        virtual void draw_children();
        virtual void on_draw_end();

    private:
        std::string m_id;
        uint64_t m_identity = 0;
        Node* m_parent = nullptr;
        std::vector<std::unique_ptr<Node>> m_children;
        bool m_visible = true;
        bool m_cancelable = false;
        InputLayer m_input_layer = InputLayer::Count;
        LayoutState m_layout;
        double m_draw_time_ms = 0.0;
        bool m_skip_draw = false;
    };

} // namespace ui
